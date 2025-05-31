// fullhelper.js - $WinLEW Bot: All Commands Reference (User + Mod/Admin)
// Use for dynamic !help menus or docs!

/**
 * Regular user commands.
 * No duplicates, sorted for clarity.
 */
export const userCommands = [
  {
    cmd: '!balance <address|.sol>',
    desc: '🔍 Check your $WinLEW balance'
  },
  {
    cmd: '!faucet <address|.sol>',
    desc: '💧 Get daily free $WinLEW tokens (one claim per 24h)'
  },
  {
    cmd: '!register <address|.sol>',
    desc: '📝 Register for $WinLEW airdrops'
  },
  {
    cmd: '!price',
    desc: '💰 View current $WinLEW price'
  },
  {
    cmd: '!supply',
    desc: '🌐 Show total $WinLEW supply'
  },
  {
    cmd: '!links',
    desc: '🔗 All major $WinLEW project links'
  },
  {
    cmd: '!buy',
    desc: '🚀 Buy $WinLEW on Pump.fun'
  },
  {
    cmd: '!dexscreener',
    desc: '📊 View $WinLEW DexScreener chart'
  },
  {
    cmd: '!rugcheck',
    desc: '🔒 Safety check for $WinLEW (RugCheck)'
  },
  {
    cmd: '!swap',
    desc: '💱 Swap on Raydium'
  },
  {
    cmd: '!geckoterminal',
    desc: '🌐 View $WinLEW pool on GeckoTerminal'
  },
  {
    cmd: '!cmc',
    desc: '📈 View CoinMarketCap listing'
  },
  {
    cmd: '!website',
    desc: '🖥️ Official $WinLEW website'
  },
  {
    cmd: '!quicklinks',
    desc: '⚡ Quick access to all $WinLEW essential links'
  },
  {
    cmd: '!data',
    desc: '📊 Full price/stats from all major sources'
  },
  {
    cmd: '!gdata',
    desc: '🦎 GeckoTerminal price and stats'
  },
  {
    cmd: '!ddata',
    desc: '📊 DexScreener price and stats'
  },
  {
    cmd: '!rdata',
    desc: '💱 Raydium price and stats'
  },
  {
    cmd: '!pdata',
    desc: '🧑‍🚀 Pump.fun price and stats'
  },
  {
    cmd: '!uptime',
    desc: '⏱️ Show bot uptime'
  },
  {
    cmd: '!help',
    desc: '📖 Show main help menu'
  },
  {
    cmd: '!fhelp',
    desc: '📖 Show all regular commands (for advanced users)'
  }
];

/**
 * Moderator/Admin-only commands.
 * Use !modhelp or !mhelp to show these.
 */
export const adminCommands = [
  {
    cmd: '!send <address|.sol>',
    desc: '✉️ Send DRIP_AMOUNT $WinLEW tokens to an address (admin only)'
  },
  {
    cmd: '!wallet',
    desc: '🤖 Show the bot’s Solana public address'
  },
  {
    cmd: '!restart',
    desc: '♻️ Restart the bot process (admin/mod only)'
  },
  {
    cmd: '!debugprice',
    desc: '🧩 Show all price source diagnostics'
  },
  {
    cmd: '!modhelp',
    desc: '🛠️ Show all moderator/admin commands'
  },
  {
    cmd: '!mhelp',
    desc: '🛠️ Show all moderator/admin commands (alternate)'
  }
];

/**
 * Utility function: return merged, unique commands for docs or audit.
 */
export function allCommands() {
  // No duplicates, user wins if in both
  const seen = {};
  userCommands.forEach(c => { seen[c.cmd] = c.desc; });
  adminCommands.forEach(c => { if (!seen[c.cmd]) seen[c.cmd] = c.desc; });
  return Object.entries(seen).map(([cmd, desc]) => ({ cmd, desc }));
}

/**
 * Dynamic formatted string for !help or !modhelp replies.
 */
export function formatCommandList(list) {
  return list.map(c => `• \`${c.cmd}\` — ${c.desc}`).join('\n');
}
