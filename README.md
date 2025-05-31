# 💰 WinLEW Discord Bot

Your all-in-one, self-hosted Discord bot for the $WinLEW Solana token.  
This bot brings **price data from multiple sources**, **faucet automation**, **community engagement tools**, and **admin features** to your Discord server—fully open, transparent, and extensible.

---

## 🌟 Features

- **Live $WinLEW Price** from GeckoTerminal, Raydium, Pump.fun, DexScreener, and more.
- **Aggregated stats**: `!data` command for all price sources at once.
- **Detailed per-source stats**: `!gdata`, `!ddata`, `!rdata`, `!pdata` commands.
- **User faucet** with 24h cooldown—one claim per wallet per day.
- **Balance checking** for Solana addresses and .sol domains.
- **Total supply** info and airdrop registration.
- **Buy/swap quicklinks** for all major DEXes and sites.
- **MOD/admin tools** and bot restart for safe management.
- **Automated Twitter/X announcements** and live channel price updates.
- **All code modular, extensible, and easy to upgrade.**

---

## 🚀 Getting Started

### 1. **Clone the Project**

```sh
git clone https://github.com/lewsales/discord-bot.git
cd winlew-bot
```

### 2. **Install Dependencies**

```sh
yarn install
```

### 3. **Configuration**

1. **Copy the `.env.example` to `.env`** and fill out all required values:

   ```
   DISCORD_BOT_TOKEN=your-bot-token
   WINLEW_MINT=your-mint-address
   BOT_KEYPAIR_PATH=./your-bot-keypair.json
   RPC_URL=https://api.mainnet-beta.solana.com
   GECKO_PAIR_ID=...
   RAYDIUM_POOL_ID=...
   PUMPFUN_POOL_ID=...
   DEXSCREENER_PAIR_ID=...
   DRIP_AMOUNT=1000
   MOD_IDS=comma,separated,discord,user,ids
   VOICE_CHANNEL_ID=...
   PRICE_CHANNEL_ID=...
   ALERT_CHANNEL_ID=...
   VOICE_WEBHOOK_URL=...
   PRICE_WEBHOOK_URL=...
   GENERAL_WEBHOOK_URL=...
   ANNOUNCEMENT_WEBHOOK_URL=...
   TWITTER_BEARER_TOKEN=...
   ```

2. **Generate a Solana keypair** (if needed) and fund it for gas.

3. **(Optional) Set up Twitter/X API credentials** for tweet relaying.

### 4. **Run the Bot**

```sh
npm start
```

---

## 🕹️ Commands

**User Commands**
- `!balance <address|.sol>` — Check your $WinLEW balance
- `!faucet <address|.sol>` — Claim free $WinLEW (once per 24h)
- `!register <address|.sol>` — Register for airdrops
- `!price` — Current $WinLEW price (best source)
- `!data` — Price from ALL sources (detailed)
- `!gdata` — GeckoTerminal stats  
- `!ddata` — DexScreener stats  
- `!rdata` — Raydium stats  
- `!pdata` — Pump.fun stats  
- `!supply` — Total token supply
- `!uptime` — Bot uptime
- `!links` — All project links
- `!quicklinks` — Fast access buy/swap/chart links
- `!buy` / `!dexscreener` / `!swap` / `!rugcheck` / `!geckoterminal` / `!cmc` / `!website` — Direct links

**Moderator/Admin Commands**
- `!restart` — Restart the bot (mod only)
- `!wallet` — Show bot wallet
- `!modhelp` — Admin menu
- `!debugprice` — Debug/fetch all price sources (mod only)

---

## ⚡ Tech Stack

- Node.js (ESM)
- Discord.js v14
- Solana web3.js & SPL-Token
- dotenv for config
- Modular fetchers for price APIs (GeckoTerminal, Raydium, DexScreener, Pump.fun, Solscan)
- Twitter API v2 (optional)
- JSON for persistent data (faucet claims, etc.)
- Cron for scheduled channel updates

---

## 🛠️ File Structure

```
.
├── bot.js                  # Main Discord bot logic
├── priceTracker.js         # Aggregated price fetching logic
├── gecko.js                # GeckoTerminal price fetcher
├── raydium.js              # Raydium price fetcher
├── pumpfun.js              # Pump.fun price fetcher
├── dexscreener.js          # DexScreener price fetcher
├── solscan.js              # (Optional) Solscan price fetcher
├── faucet.js               # Faucet and drip logic
├── .env                    # Environment config
└── README.md
```

---

## 🧠 Notes & Best Practices

- **Keep your .env safe!** Never commit it with secrets.
- Run the bot under `pm2` or Docker for auto-restart on crash.
- Back up your keypair file securely.
- Update dependencies regularly for security.
- Extend or modify fetchers as new price APIs emerge.

---

## 🤝 Contributing

PRs, feature requests, and feedback are welcome!
Open an issue or fork and make a PR.

---

## 📣 Credits

- $WinLEW Community  
- [LETS EVERYONE WIN Discord](https://discord.gg/7mZ2JP87JS)
- [Official Site](http://WinLEW.xyZ)

---

*Built with ❤️ by passionate builders for the #WinLEW fam.*
