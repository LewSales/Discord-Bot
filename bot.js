import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import cron from 'node-cron';
import { Client, GatewayIntentBits, Partials, WebhookClient } from 'discord.js';
import { TwitterApi } from 'twitter-api-v2';
import { dripTokens } from './faucet.js';
import * as splTokenPkg from '@solana/spl-token';
import * as splNameService from "@bonfida/spl-name-service";
import { fetchGeckoTerminalPrice, POOL_ID as GECKO_POOL_ID } from './gecko.js';
import { fetchDexScreenerPrice, POOL_ID as DEXSCREENER_POOL_ID } from './dexscreener.js';
import { fetchPumpFunPrice, POOL_ID as PUMPFUN_POOL_ID } from './pumpfun.js';
import { fetchRaydiumPrice, POOL_ID as RAYDIUM_POOL_ID } from './raydium.js';
import { fetchSolScanPrice, POOL_ID as SOLSCAN_POOL_ID } from './solscan.js';
import { fetchBestPrice } from './priceTracker.js';
import { Connection, clusterApiUrl, PublicKey, Keypair } from "@solana/web3.js";

// Error handlers
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

// Config & Validation
const {
  RPC_URL,
  MOD_IDS,
  COMMAND_PREFIX,
  DISCORD_BOT_TOKEN,
  TWITTER_BEARER_TOKEN,
  VOICE_CHANNEL_ID,
  PRICE_CHANNEL_ID,
  BOT_KEYPAIR_PATH,
  VOICE_WEBHOOK_URL,
  PRICE_WEBHOOK_URL,
  GENERAL_WEBHOOK_URL,
  ANNOUNCEMENT_WEBHOOK_URL,
  WINLEW_MINT,
  DRIP_AMOUNT
} = process.env;

// Check required env vars
const checks = [
  ['DISCORD_BOT_TOKEN',      DISCORD_BOT_TOKEN],
  ['TWITTER_BEARER_TOKEN',   TWITTER_BEARER_TOKEN],
  ['VOICE_WEBHOOK_URL',      VOICE_WEBHOOK_URL],
  ['PRICE_WEBHOOK_URL',      PRICE_WEBHOOK_URL],
  ['GENERAL_WEBHOOK_URL',    GENERAL_WEBHOOK_URL],
  ['ANNOUNCEMENT_WEBHOOK_URL', ANNOUNCEMENT_WEBHOOK_URL],
  ['VOICE_CHANNEL_ID',       VOICE_CHANNEL_ID],
  ['PRICE_CHANNEL_ID',       PRICE_CHANNEL_ID],
  ['RPC_URL',                RPC_URL],
  ['WINLEW_MINT',            WINLEW_MINT],
  ['BOT_KEYPAIR_PATH',       BOT_KEYPAIR_PATH],
  ['COMMAND_PREFIX',         COMMAND_PREFIX + ' (default)'],
  ['DRIP_AMOUNT',            DRIP_AMOUNT],
  ['MOD_IDS',                MOD_IDS],
];
console.log('→ .env loaded:');
checks.forEach(([name, val]) => {
  const status = val ? '✅ Completed' : '❌ Rejected';
  console.log(` • ${name.padEnd(22)} : ${status}`);
});
const missing = checks.filter(([name, val]) => !val && name !== 'COMMAND_PREFIX').map(([name]) => name);
if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);

// Setup Solana, Webhooks, Keypair, etc.
const connection = new Connection(RPC_URL || clusterApiUrl("mainnet-beta"));
console.log("RPC_URL loaded:", RPC_URL);

if (!WINLEW_MINT || WINLEW_MINT.length < 32) {
  throw new Error('WINLEW_MINT is not set or is invalid in your .env file!');
}
const TOKEN_MINT = new PublicKey(WINLEW_MINT);

function loadKeypair(path) {
  const bytes = JSON.parse(fs.readFileSync(path, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}
const BOT_KEYPAIR = loadKeypair(BOT_KEYPAIR_PATH);

// MOD_IDS from .env as array (comma-separated)
const MOD_ID_LIST = MOD_IDS
  ? MOD_IDS.split(',').map(id => id.trim())
  : [];

const PREFIX = COMMAND_PREFIX || '!';
const DRIP = Number(DRIP_AMOUNT) || 1000;
if (isNaN(DRIP) || DRIP <= 0) throw new Error("Invalid DRIP_AMOUNT in .env! It must be a positive number.");

const addressCache = new Map();
const { getDomainKey, NameRegistryState, reverseLookup } = splNameService;

// ---- Discord Client ----
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

client.on('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

const voiceWebhook = new WebhookClient({ url: VOICE_WEBHOOK_URL });
const priceWebhook = new WebhookClient({ url: PRICE_WEBHOOK_URL });
const generalWebhook = new WebhookClient({ url: GENERAL_WEBHOOK_URL });
const announcementWebhook = ANNOUNCEMENT_WEBHOOK_URL ? new WebhookClient({ url: ANNOUNCEMENT_WEBHOOK_URL }) : null;

// --- Helpers
const loadJson = (path) => { try { return JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return {}; } };
const writeJson = (path, data) => { fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8'); };

// --- Persistent Faucet Claims
const CLAIMS_FILE = './faucet_claims.json';
function getFaucetClaims() { return loadJson(CLAIMS_FILE); }
function setFaucetClaim(address, timestamp) {
  const claims = getFaucetClaims();
  claims[address] = timestamp;
  writeJson(CLAIMS_FILE, claims);
}

// --- SNS Resolution ---
async function resolveSolanaAddress(address, conn = null) {
  address = address.trim();
  const now = Date.now();
  if (address.toLowerCase().endsWith('.sol')) {
    const domain = address.slice(0, -4).toLowerCase();
    const cached = addressCache.get(domain);
    if (cached && cached.expires > now) {
      console.log(`[DEBUG] Cache hit for: ${address} → ${cached.pubkey.toBase58()}`);
      return cached.pubkey;
    }
    try {
      const useConn = conn || connection;
      const { pubkey } = await getDomainKey(domain);
      const registry = await NameRegistryState.retrieve(useConn, pubkey);
      if (!registry.owner) throw new Error(`SNS: The .sol name \`${address}\` has no owner!`);
      addressCache.set(domain, { pubkey: registry.owner, expires: now + 10 * 60 * 1000 });
      addressCache.set(registry.owner.toBase58(), { pubkey: registry.owner, expires: now + 10 * 60 * 1000 });
      console.log(`[DEBUG] .sol domain ${address} → ${registry.owner.toBase58()}`);
      return registry.owner;
    } catch (err) {
      if (err.message && err.message.includes('Account does not exist')) {
        throw new Error(`SNS: The .sol name \`${address}\` does not exist or is not registered on Solana mainnet.`);
      }
      throw new Error(`SNS: Could not resolve \`${address}\`: ${err.message}`);
    }
  }
  // Direct pubkey
  try {
    const pubkey = new PublicKey(address);
    addressCache.set(address, { pubkey, expires: now + 10 * 60 * 1000 });
    console.log(`[DEBUG] Direct pubkey: ${address} → ${pubkey.toBase58()}`);
    return pubkey;
  } catch (err) {
    throw new Error(`Invalid Solana public key: ${address}`);
  }
}

async function resolveSolanaName(pubkey, conn = connection) {
  try {
    const name = await reverseLookup(conn, new PublicKey(pubkey));
    return name ? name + '.sol' : null;
  } catch (err) {
    if (err.type === 'AccountDoesNotExist') return null;
    return null;
  }
}

// ---- Twitter State ----
let twitterUserId;
let lastTweetId;
const twitterClient = new TwitterApi(TWITTER_BEARER_TOKEN);
const TWITTER_USERNAME = process.env.TWITTER_USERNAME || "WinLewToken";
const roClient = twitterClient.readOnly;
async function loadTwitterUserId() {
  const data = loadJson('./twitterUserId.json');
  if (data?.twitterUserId) twitterUserId = data.twitterUserId;
  else {
    const user = await twitterClient.v2.userByUsername('WinLewToken');
    twitterUserId = user.data.id;
    writeJson('./twitterUserId.json', { twitterUserId });
  }
}
function loadLastTweetId() {
  const data = loadJson('./lastTweet.json');
  lastTweetId = (data && data.lastTweetId) ? String(data.lastTweetId) : '1926684491428298868';
}


// ---- Commands ----
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const lastUsed = new Map();

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;
  const [rawCmd, ...args] = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = rawCmd.toLowerCase();
  const now = Date.now();
  const cooldownKey = `${cmd}:${message.author.id}`;

  try {

    switch (cmd) {
      // ─── Admin Commands ────────────────────────────────
      case 'uptime': {
        const ms = process.uptime() * 1000,
          s = Math.floor(ms / 1000) % 60,
          m = Math.floor(ms / (1000 * 60)) % 60,
          h = Math.floor(ms / (1000 * 60 * 60));
       await message.reply(`⏳ Uptime: ${h}h ${m}m ${s}s`);
        break;
      }
      case 'restart': {
        if (!MOD_ID_LIST.includes(message.author.id)) {
          await message.reply('❌ You are not authorized to restart the bot.');
          break;
        }
        await message.reply('♻️ Restarting bot...');
        process.exit(0);
        break;
      }
      case 'modhelp': {
        if (!MOD_ID_LIST.includes(message.author.id)) {
          await message.reply('❌ This command is restricted.');
          break;
        }
        await message.reply(
          '🛠️ **Moderator/Admin Commands:**\n' +
          '• `!restart` — ♻️ Restart the bot (admin only)\n' +
          '• `!wallet` — 🤖 Show bot\'s public Solana address\n' +
          '• `!debugprice` — 🧩 Show all price source diagnostics\n' +
          '• `!modhelp` — 🛠️ Show this mod/admin help menu\n' +
          '\n' +
          '🔒 *All regular user commands are also available to mods. Use with caution!*'
        );
        break;
      }
      // ─── Main User Commands ────────────────────────────
    case 'balance': {
  const address = args[0];
  if (!address) {
    await message.reply('Usage: !balance <Your Solana ADDRESS or .sol>');
    break;
  }
  let ownerPubkey;
  try {
    ownerPubkey = await resolveSolanaAddress(address);
  } catch (err) {
    await message.reply('❌ Invalid address or .sol domain');
    break;
  }

  // fetch WinLEW token accounts for that owner
  const resp = await connection.getParsedTokenAccountsByOwner(ownerPubkey, { mint: TOKEN_MINT });


  if (resp.value.length === 0) {
    await message.reply('ℹ️ No $WinLEW account found for that address.');
    break;
  }

  const total = resp.value
    .map(a => a.account.data.parsed.info.tokenAmount.uiAmount || 0)
    .reduce((sum, x) => sum + x, 0);

  await message.reply(`🔍 Balance: ${total} WinLEW`);
  break;
}

      case 'faucet': {
        const address = args[0];
        if (!address) {
          await message.reply('Usage: !faucet <Your Solana ADDRESS or .sol>');
          break;
        }
        let recipient;
        try { recipient = await resolveSolanaAddress(address); }
        catch {
          await message.reply('❌ Invalid address or .sol domain');
          break;
        }
        const claims = getFaucetClaims();
        const nowSec = Math.floor(Date.now() / 1000);
        const prev = claims[recipient.toBase58()];
        if (prev && nowSec - prev < 86400) {
          await message.reply('⏳ This address already claimed the faucet in the past 24h!💥');
          break;
        }
        if (now < (lastUsed.get(cooldownKey) || 0)) {
          const hours = Math.ceil(((lastUsed.get(cooldownKey) || 0) - now) / 3600000);
          await message.reply(`⏳ Please wait ~${hours}h to use that command again.`);
          break;
        }
        lastUsed.set(cooldownKey, now + COOLDOWN_MS);
        try {
          const sig = await dripTokens(connection, BOT_KEYPAIR, recipient);
          setFaucetClaim(recipient.toBase58(), nowSec);
          await message.reply(`💧 Dripped! Tx: <https://solscan.io/tx/${sig}>\n_If you don't see the transaction on Solscan right away, please wait a minute and check again!_`);
        } catch (err) {
          if (
            err.message && (
              err.message.includes('💥could not find an ATA account') ||
              err.message.includes('TokenAccountNotFoundError') ||
              err.message.includes('💥Failed to send $WinLEW')
            )
          ) {
            await message.reply('💥 Error No ATA Account! (Recipient must create their $WinLEW token account first)');
            break;
          }
          console.error(`[${new Date().toISOString()}] Faucet ERROR for ${address}:`, err);
          await message.reply(`❌ ${err.message}`);
        }
        break;
      }
      case 'send': {
        if (!MOD_ID_LIST.includes(message.author.id)) {
          await message.reply('❌ You are not authorized to use this command.');
          break;
        }
        const address = args[0];
        if (!address) {
          await message.reply('Usage: !send <Your Solana ADDRESS or .sol>');
          break;
        }
        let recipient;
        try { recipient = await resolveSolanaAddress(address); }
        catch {
          await message.reply('❌ Invalid address or .sol domain');
          break;
        }
        if (recipient.equals(BOT_KEYPAIR.publicKey)) {
          await message.reply('❌ Cannot send tokens to the bot\'s own address!');
          break;
        }
        if (now < (lastUsed.get(cooldownKey) || 0)) {
          const hours = Math.ceil(((lastUsed.get(cooldownKey) || 0) - now) / 3600000);
          await message.reply(`⏳ Please wait ~${hours}h to use that command again.`);
          break;
        }
        lastUsed.set(cooldownKey, now + COOLDOWN_MS);
        try {
          const fromAta = await splTokenPkg.getOrCreateAssociatedTokenAccount(
            connection, BOT_KEYPAIR, TOKEN_MINT, BOT_KEYPAIR.publicKey
          );
          const toAta = await splTokenPkg.getOrCreateAssociatedTokenAccount(
            connection, BOT_KEYPAIR, TOKEN_MINT, recipient
          );
          const sig = await splTokenPkg.transfer(
            connection, BOT_KEYPAIR, fromAta.address, toAta.address,
            BOT_KEYPAIR.publicKey, DRIP_AMOUNT * 1e6
          );
          await message.reply(
            `✅ Sent ${DRIP_AMOUNT} WinLEW! Tx: <https://solscan.io/tx/${sig}>\n_If you don't see the transaction on Solscan right away, please wait a minute and check again!_`
          );
        } catch (err) {
          if (
            err.name === 'TransactionExpiredBlockheightExceededError' ||
            (err.message && err.message.includes('block height exceeded'))
          ) {
            await message.reply(
              '⏰ Transaction expired (block height exceeded). The Solana network was too slow or the transaction was sent too late. Please try again!'
            );
            break;
          }
          console.error(`[${new Date().toISOString()}] Send ERROR for ${address}:`, err);
          await message.reply(`❌ Failed to send: ${err.message || err}`);
        }
        break;
      }
      case 'register': {
        const address = args[0];
        if (!address) {
          await message.reply('Usage: !register <Your Solana ADDRESS or .sol>');
          break;
        }
        ['registrations.json', 'airdrops.json'].forEach(file => {
  const data = loadJson(file);
  const list = Array.isArray(data) ? data : [];
  list.push(address);
  writeJson(file, list);
});
await message.reply(`✅ Registered ${address}`);
        break;
      }
      case 'price': {
  try {
    const result = await fetchBestPrice();
    const price = result?.price || Number(result);
    if (!price || isNaN(Number(price))) {
      await message.reply('❌ Could not fetch a valid $WinLEW price. Please try again later!');
      break;
    }
    await message.reply(`💰 WinLEW Price: $${Number(price).toFixed(6)}`);
  } catch (err) {
    await message.reply('❌ No price source available for $WinLEW right now.');
    console.error('!price error:', err);
  }
  break;
  }
      
   case 'data': {
  // Let users know it's fetching if it may take a second
  await message.reply('⏳ Fetching all price source data for $WinLEW, please wait...');

  // Run fetches in parallel
  const [
    gecko,
    dexscreener,
    raydium,
    pumpfun
  ] = await Promise.allSettled([
    (async () => {
      const { fetchGeckoTerminalPrice } = await import('./gecko.js');
      return await fetchGeckoTerminalPrice(process.env.GECKO_PAIR_ID);
    })(),
    (async () => {
      const { fetchDexScreenerPrice } = await import('./dexscreener.js');
      return await fetchDexScreenerPrice(process.env.DEXSCREENER_PAIR_ID);
    })(),
    (async () => {
      const { fetchRaydiumPrice } = await import('./raydium.js');
      return await fetchRaydiumPrice(process.env.RAYDIUM_POOL_ID);
    })(),
    (async () => {
      const { fetchPumpFunPrice } = await import('./pumpfun.js');
      return await fetchPumpFunPrice(process.env.PUMPFUN_POOL_ID);
    })()
  ]);

  // Format results
  let out = '📊 **$WinLEW Data From All Major Sources:**\n\n';

  // GeckoTerminal
    if (gecko.status === "fulfilled" && gecko.value?.price) {
    const info = gecko.value;
    out +=
      `🦎 **GeckoTerminal**\n` +
      `• Price: $${info.price.toFixed(6)}\n` +
      `• Pool: ${info.poolName}\n` +
      (info.baseSymbol ? `• Base: ${info.baseSymbol} (${info.baseAddress})\n` : '') +
      (info.quoteSymbol ? `• Quote: ${info.quoteSymbol}\n` : '') +
      (info.fdv ? `• FDV: $${Number(info.fdv).toLocaleString(undefined, { maximumFractionDigits: 0 })}\n` : '') +
      (info.volume24h ? `• 24h Volume: $${Number(info.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}\n` : '') +
      `• [View Pool](${info.url})\n\n`;
  } else {
    out += `🦎 **GeckoTerminal:** ❌ Error: ${gecko.reason?.message || gecko.reason || "Unavailable"}\n\n`;
  }

  // DexScreener
  if (dexscreener.status === "fulfilled" && dexscreener.value?.price) {
    const info = dexscreener.value;
    out +=
      `📊 **DexScreener**\n` +
      `• Price: $${info.price.toFixed(6)}\n` +
      (info.baseSymbol ? `• Base: ${info.baseSymbol}\n` : '') +
      (info.quoteSymbol ? `• Quote: ${info.quoteSymbol}\n` : '') +
      `• [View Pair](${info.url})\n\n`;
  } else {
    out += `📊 **DexScreener:** ❌ Error: ${dexscreener.reason?.message || dexscreener.reason || "Unavailable"}\n\n`;
  }

  // Raydium
  if (raydium.status === "fulfilled" && raydium.value?.price) {
    const info = raydium.value;
    out +=
      `💱 **Raydium**\n` +
      `• Price: $${info.price.toFixed(6)}\n` +
      (info.poolName ? `• Pool: ${info.poolName}\n` : '') +
      (info.baseSymbol ? `• Base: ${info.baseSymbol} (${info.baseAddress})\n` : '') +
      (info.quoteSymbol ? `• Quote: ${info.quoteSymbol}\n` : '') +
      (info.tvl ? `• TVL: $${Number(info.tvl).toLocaleString(undefined, { maximumFractionDigits: 0 })}\n` : '') +
      (info.volume24h ? `• 24h Volume: $${Number(info.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}\n` : '') +
      `• [View Pool](${info.url})\n\n`;
  } else {
    out += `💱 **Raydium:** ❌ Error: ${raydium.reason?.message || raydium.reason || "Unavailable"}\n\n`;
  }

  // Pump.fun
  if (pumpfun.status === "fulfilled" && pumpfun.value?.price) {
    const info = pumpfun.value;
    out +=
      `🧑‍🚀 **Pump.Fun**\n` +
      `• Price: $${info.price.toFixed(6)}\n` +
      (info.symbol ? `• Symbol: ${info.symbol}\n` : '') +
      (info.name ? `• Name: ${info.name}\n` : '') +
      `• [View Coin](${info.url})\n`;
  } else {
    out += `🧑‍🚀 **Pump.Fun:** ❌ Error: ${pumpfun.reason?.message || pumpfun.reason || "Unavailable"}\n`;
  }

  // Discord message length check
  if (out.length > 1900) out = out.slice(0, 1900) + '…';

  await message.reply(out);
  break;
}
      // ──────────── Debug Price Command ───────────────
      case 'debugprice': {
        if (!MOD_ID_LIST.includes(message.author.id)) {
          await message.reply('❌ This command is restricted.');
          break;
        }
        let out = '🛠️ Debugging price sources...\n';
        try {
          // Dynamic import with cache bust
          const m = await import('./priceTracker.js?' + Date.now());
          try {
            const solscan = await fetchSolScanPrice(process.env.SOLSCAN_POOL_ID);
            out += `Solscan ✅: $${solscan}\n`;
          } catch (e) {
            out += 'Solscan ❌: ' + e.message + '\n';
          }
          try {
            const raydium = await fetchRaydiumPrice(process.env.RAYDIUM_POOL_ID);
            out += `💱Raydium ✅: $${raydium}\n`;
          } catch (e) {
            out += '💱Raydium ❌: ' + e.message + '\n';
          }
          try {
            const pumpfun = await fetchPumpFunPrice(process.env.PUMPFUN_POOL_ID);
            out += `🧑‍🚀Pump.Fun ✅: $${pumpfun}\n`;
          } catch (e) {
            out += '🧑‍🚀Pump.Fun ❌: ' + e.message + '\n';
          }
          try {
            const dexscreener = await fetchDexScreenerPrice(process.env.DEXSCREENER_PAIR_ID);
            out += `📊Dexscreener ✅: $${dexscreener}\n`;
          } catch (e) {
            out += '📊Dexscreener ❌: ' + e.message + '\n';
          }
          try {
            const gecko = await fetchGeckoTerminalPrice(process.env.GECKO_PAIR_ID);
            out += `🦎GeckoTerminal ✅: $${gecko}\n`;
          } catch (e) {
            out += '🦎GeckoTerminal ❌: ' + e.message + '\n';
          }
          await message.reply(out.length > 1900 ? out.slice(0, 1900) + '…' : out);
        } catch (err) {
          await message.reply('❌ Error loading price tracker module: ' + (err.message || err));
        }
      break;
      }
        case 'ddata': {
         try {
         const { fetchDexScreenerPrice } = await import('./dexscreener.js');
         const info = await fetchDexScreenerPrice(DEXSCREENER_POOL_ID);
         if (!info.price || isNaN(info.price)) {
      await message.reply('❌ Could not fetch a valid Dexscreener price. Try again later!');
     break;
     }
      await message.reply(
      `📊 **DexScreener $WinLEW Stats**\n` +
      `• **Price**: $${info.price.toFixed(6)}\n` +
      (info.baseSymbol ? `• **Base**: ${info.baseSymbol}\n` : '') +
      (info.quoteSymbol ? `• **Quote**: ${info.quoteSymbol}\n` : '') +
      `• [View on DexScreener](${info.url})`
    );
  } catch (err) {
    await message.reply('❌ Error fetching DexScreener data: ' + (err.message || err));
  }
    break;
    }
     case 'gdata': {
  try {
    const info = await fetchGeckoTerminalPrice(GECKO_POOL_ID);
    if (!info.price || isNaN(info.price)) {
      await message.reply('❌ Could not fetch a valid GeckoTerminal price. Try again later!');
      break;
    }
    // Compose message with more details
    await message.reply(
      `🦎 **GeckoTerminal $WinLEW Stats**\n` +
      `• **Price**: $${info.price.toFixed(6)}\n` +
      `• **Pool**: ${info.poolName}\n` +
      `• **Base**: ${info.baseSymbol} (${info.baseAddress})\n` +
      `• **Quote**: ${info.quoteSymbol}\n` +
      `• **FDV**: $${Number(info.fdv).toLocaleString(undefined, { maximumFractionDigits: 0 })}\n` +
      `• **24h Volume**: $${Number(info.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}\n` +
      `• [View on GeckoTerminal](${info.url})`
    );
  } catch (err) {
    await message.reply('❌ Error fetching GeckoTerminal data: ' + (err.message || err));
  }
  break;
  }
case 'rdata': {
  try {
    const { fetchRaydiumPrice } = await import('./raydium.js');
    const info = await fetchRaydiumPrice(RAYDIUM_POOL_ID);
    if (!info.price || isNaN(info.price)) {
      await message.reply('❌ Could not fetch a valid Raydium price. Try again later!');
      break;
    }
    await message.reply(
      `💱 **Raydium $WinLEW Stats**\n` +
      `• **Price**: $${info.price.toFixed(6)}\n` +
      (info.poolName ? `• **Pool**: ${info.poolName}\n` : '') +
      (info.baseSymbol ? `• **Base**: ${info.baseSymbol} (${info.baseAddress})\n` : '') +
      (info.quoteSymbol ? `• **Quote**: ${info.quoteSymbol}\n` : '') +
      (info.tvl ? `• **TVL**: $${Number(info.tvl).toLocaleString(undefined, { maximumFractionDigits: 0 })}\n` : '') +
      (info.volume24h ? `• **24h Volume**: $${Number(info.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}\n` : '') +
      `• [View on Raydium](${info.url})`
    );
  } catch (err) {
    await message.reply('❌ Error fetching Raydium data: ' + (err.message || err));
  }
  break;
}
case 'pdata': {
  try {
    const { fetchPumpFunPrice } = await import('./pumpfun.js');
    const info = await fetchPumpFunPrice(PUMPFUN_POOL_ID);
    if (!info.price || isNaN(info.price)) {
      await message.reply('❌ Could not fetch a valid Pump.Fun price. Try again later!');
      break;
    }
    await message.reply(
      `🧑‍🚀 **Pump.fun $WinLEW Stats**\n` +
      `• **Price**: $${info.price.toFixed(6)}\n` +
      (info.symbol ? `• **Symbol**: ${info.symbol}\n` : '') +
      (info.name ? `• **Name**: ${info.name}\n` : '') +
      `• [View on Pump.fun](${info.url})`
    );
  } catch (err) {
    await message.reply('❌ Error fetching Pump.Fun data: ' + (err.message || err));
  }
  break;
}
case 'sdata': {
  try {
    const { fetchPumpFunPrice } = await import('./pumpfun.js');
    const info = await fetchSolScanPrice(SOLSCAN_POOL_ID);
    if (!info.price || isNaN(info.price)) {
      await message.reply('❌ Could not fetch a valid Pump.Fun price. Try again later!');
      break;
    }
    await message.reply(
      `🧑‍🚀 **Pump.fun $WinLEW Stats**\n` +
      `• **Price**: $${info.price.toFixed(6)}\n` +
      (info.symbol ? `• **Symbol**: ${info.symbol}\n` : '') +
      (info.name ? `• **Name**: ${info.name}\n` : '') +
      `• [View on Pump.fun](${info.url})`
    );
  } catch (err) {
    await message.reply('❌ Error fetching Pump.Fun data: ' + (err.message || err));
  }
      break;
      }



      case 'wallet': {
        await message.reply(`🤖 The [Bot](http://x.com/LetEveryOneWin) Wallet: diglew.sol & burn.winlew.sol\n \`${BOT_KEYPAIR.publicKey.toBase58()}\``);
        break;
      }
      case 'xwallet': {
        await message.reply('🤖 The [WinLewToken](http://x.com/WinLewToken) Wallet: Winlew.sol\n`GFxz42bib3o6kxmPgK95fMtBxRk16yaTvt5UBwC7EhAp`');
        break;
      }
      case 'devwallet': {
        await message.reply('🛠️ [LewSales](http://x.com/LewSales) Wallet: LewSales.sol\n`D6d5byBxBcddovgQ2UPUMpPDpJukjyC7C4Hcg3v4FRkZ`');
        break;
      }
      case 'supply': {
        const info = await connection.getTokenSupply(TOKEN_MINT);
        await message.reply(`🌐 Total supply: ${info.value.uiAmount} WinLEW`);
        break;
      }
      case 'buy': {
        await message.reply('🚀 Buy $WinLEW now on Pump.fun:\n<https://pump.fun/coin/DnrcdQVH7fdbmm4EyD7LjT9mNNozF5HuWMeKcpvjpump>');
        break;
      }
      case 'dexscreener': {
        await message.reply('📊 Check $WinLEW charts and stats on DexScreener:\n<https://dexscreener.com/solana/h3hoytv5tg6a2uzqsjhncidgwcwx4h3kdnewfjmlmgfg>');
        break;
      }
      case 'rugcheck': {
        await message.reply('🔒 Be safe! Verify $WinLEW on RugCheck:\n<https://rugcheck.xyz/tokens/DnrcdQVH7fdbmm4EyD7LjT9mNNozF5HuWMeKcpvjpump>');
        break;
      }
      case 'swap': {
        await message.reply('💱 Swap your tokens for $WinLEW using Raydium:\n<https://raydium.io/swap/?inputMint=sol&outputMint=DnrcdQVH7fdbmm4EyD7LjT9mNNozF5HuWMeKcpvjpump>');
        break;
      }
      case 'geckoterminal': {
        await message.reply('🦎 View $WinLEW pool on GeckoTerminal:\n<https://www.geckoterminal.com/solana/pools/5nTz6Cq7U54TArLEFMgFUatcZXh5NG9BVrecqMrJ92Lx>');
        break;
      }
      case 'cmc': {
        await message.reply('📈 Track $WinLEW on CoinMarketCap:\n<https://coinmarketcap.com/dexscan/solana/H3HoYtV5tg6a2UZqSJhnCidgWcwX4h3KdNewfJMLMgfg/>');
        break;
      }
      case 'website': {
        await message.reply('🖥️ Visit our official site:\n<http://WinLEW.xyZ>');
        break;
      }
      case 'help': {
        await message.reply(
         '📖 **Commands:**\n' +
         '• `!balance <Your Solana Address or .sol>`\nCheck your $WinLEW balance 🔍\n' +
         '• `!data`  — 📈 Detailed price data\n' +
         '• `!faucet <Your Solana Address or .sol>` \nGet some free $WinLEW tokens 💧\n' +
         '• `!price` — 💰 View current $WinLEW price\n' +
         '• `!register <Your Solana Address or .sol>`\nRegister for Future Airdrops 📝\n' +
         '• `!send <Your Solana Address or .sol>`\nReceive ' + DRIP_AMOUNT + ' $WinLEW (admin only)✉️\n' +
         '• `!supply` — 🌐 Total $WinLEW supply\n' +
         '• `!uptime` — ⏱️ Bot uptime\n' +
         '• `!links` — 🔗 Get all major $WinLEW links\n' +
         ' `\n' +
         '💰 `!buylinks` — 💰 Get all The $WinLEW Charts\n' +
         '📊 `!ddata`  — 📊 Detailed price data\n' +
         '🦎 `!gdata`  — 🦎 Detailed price data\n' +
         '🧑‍🚀 `!pdata`  — 🧑‍🚀 Detailed price data\n' +
         '💱 `!rdata`  — 💱 Detailed price data\n' +
         '🤖 `!wallet` — 🤖 Show bot\'s public Solana address\n' +
         '⚡ `!xwallet` — ⚡ Show WinLew.Sol\'s public Solana address\n' +
         '⚡ `!devwallet` — 🛠️ Show Developer\'s public Solana address\n' +
         '🛠️ `!modhelp` — (For MOD use ONLY)\n'
       );
      break;
      }
      case 'links': {
        await message.reply(
          '🔗 **All $WinLEW Links:**\n' +
          '• Burn/Token X Account: 💥<http://burn.WinLEW.xyZ>\n' +
          '• Dev\'s X Account: 🛠️<http://dev.WinLEW.xyZ>\n' +
          '• Faucet X Account: 🤖<http://faucet.WinLEW.xyZ>\n' +
          '• The OFFICIAL Website: 🌐<http://WinLEW.xyZ>\n' +
          '\n' +
          '• CoinMarketCap: 📈<https://coinmarketcap.com/dexscan/solana/H3HoYtV5tg6a2UZqSJhnCidgWcwX4h3KdNewfJMLMgfg/>\n' +
          '• DexScreener: 📊<https://dexscreener.com/solana/h3hoytv5tg6a2uzqsjhncidgwcwx4h3kdnewfjmlmgfg>\n' +
          '• GeckoTerminal: 🦎<https://www.geckoterminal.com/solana/pools/5nTz6Cq7U54TArLEFMgFUatcZXh5NG9BVrecqMrJ92Lx>\n' +
          '• Pump.fun: 🧑‍🚀<https://pump.fun/coin/DnrcdQVH7fdbmm4EyD7LjT9mNNozF5HuWMeKcpvjpump>\n' +
          '• Raydium: 💱<https://raydium.io/swap/?inputMint=sol&outputMint=DnrcdQVH7fdbmm4EyD7LjT9mNNozF5HuWMeKcpvjpump>\n' +
          '• RugCheck: 🔒<https://rugcheck.xyz/tokens/DnrcdQVH7fdbmm4EyD7LjT9mNNozF5HuWMeKcpvjpump>\n' +
          '• SolScan: 🔗<https://solscan.io/token/DnrcdQVH7fdbmm4EyD7LjT9mNNozF5HuWMeKcpvjpump>\n'
        );
        break;
      }
      case 'buylinks': {
        await message.reply(
          '🔗 **$WinLEW buy Links:**\n' +
          '• [Buy on Pump.fun]🧑‍🚀(<https://pump.fun/coin/DnrcdQVH7fdbmm4EyD7LjT9mNNozF5HuWMeKcpvjpump>)\n' +
          '• [Swap on Raydium]💱(<https://raydium.io/swap/?inputMint=sol&outputMint=DnrcdQVH7fdbmm4EyD7LjT9mNNozF5HuWMeKcpvjpump>)\n' +
          '• [The GeckoTerminal Pool]🦎(<https://www.geckoterminal.com/solana/pools/5nTz6Cq7U54TArLEFMgFUatcZXh5NG9BVrecqMrJ92Lx>)\n' +
          '• [The Dexscreener Chart A]📊(<https://dexscreener.com/solana/h3hoytv5tg6a2uzqsjhncidgwcwx4h3kdnewfjmlmgfg>)\n' +
          '• [The Dexscreener Chart B]📊(<https://dexscreener.com/solana/5nTz6Cq7U54TArLEFMgFUatcZXh5NG9BVrecqMrJ92Lx>)\n' +
          '• [The CoinMarketCap Chart]📈(<https://coinmarketcap.com/dexscan/solana/H3HoYtV5tg6a2UZqSJhnCidgWcwX4h3KdNewfJMLMgfg/>)\n'
  );
  break;
}
    } 
  } catch (err) {
    console.error('Command error:', err);
    try { await message.reply('❌ An error occurred: ' + (err.message || err)); } catch {}
  }
}); 


// ... (commands go here, omitted for brevity!)


// Cron job to fetch tweets hourly
cron.schedule('0 * * * *', async () => {
  try {
    console.log(`[TWITTER] Checking for new tweets from userId=${twitterUserId}, since lastTweetId=${lastTweetId}`);
    
    const timeline = await roClient.v2.userTimeline(twitterUserId, {  
  since_id: lastTweetId,
  'tweet.fields': ['created_at', 'text']
});
    const tweets = timeline.data?.data;

    if (Array.isArray(tweets) && tweets.length > 0) {
      // Only post new tweets
      const newTweets = lastTweetId
        ? tweets.filter(t => BigInt(t.id) > BigInt(lastTweetId))
        : tweets;

      if (!lastTweetId || lastTweetId === '1926684491428298868') {
        lastTweetId = tweets[0].id;
        writeJson('./lastTweet.json', { lastTweetId });
        console.log(`[TWITTER] First run, not posting. Set lastTweetId to ${lastTweetId}`);
        return;
      }

      for (const tweet of newTweets.reverse()) {
        const url = `https://x.com/${TWITTER_USERNAME}/status/${tweet.id}`;
        await generalWebhook.send({
          content: `🆕 New Tweet from @${TWITTER_USERNAME}:\n${tweet.text}\n${url}`
        });
      }
      lastTweetId = tweets[0].id;
      writeJson('./lastTweet.json', { lastTweetId });
    }
  } catch (e) {
    console.error('Twitter poll error:', e);
  }
});
// Voice channel price update
cron.schedule('2 * * * *', async () => {
  try {
    const result = await fetchBestPrice();
    const price = result?.price || Number(result);
    const channel = await client.channels.fetch(VOICE_CHANNEL_ID);
    if (channel && typeof channel.isVoiceBased === "function" && channel.isVoiceBased()) {
      await channel.setName(`💰 WinLEW: $${Number(price).toFixed(6)}`);
      console.log(`[CRON] Voice channel renamed to: 💰 WinLEW: $${Number(price).toFixed(6)}`);
    } else {
      console.error('[CRON] VOICE_CHANNEL_ID is not a voice channel or not found!');
    }
  } catch (e) {
    console.error('[CRON] Failed to rename channel:', e);
  }
});

// Price channel update
cron.schedule('4 * * * *', async () => {
  try {
    const result = await fetchBestPrice();
    const price = result?.price || Number(result);
    const channel = await client.channels.fetch(PRICE_CHANNEL_ID);
    if (!channel) {
      console.error('PRICE_CHANNEL_ID not found!');
      return;
    }
    await channel.setName(`💰WinLEW:$${Number(price).toFixed(6)}`);
  } catch (e) {
    console.error('Price rename error:', e);
  }
});

// ─── Start Bot ───────────────────────────────────────────────
client.login(DISCORD_BOT_TOKEN);
