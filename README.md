# WinLEW Discord Bot

Your all-in-one, self-hosted Discord bot for the $WinLEW Solana token.
Brings **live price data from multiple sources**, **faucet automation**, **community engagement tools**, and **admin features** to your Discord server — fully open, transparent, and extensible.

---

## Features

- **Live price** from GeckoTerminal, Raydium, Pump.fun, DexScreener, and Solscan
- **Aggregated stats**: `!data` for all price sources at once
- **Per-source stats**: `!gdata`, `!ddata`, `!rdata`, `!pdata`, `!sdata`
- **User faucet** with 24h per-wallet cooldown
- **Balance checking** for Solana addresses and .sol domains
- **Token supply** info and airdrop registration
- **Buy/swap quicklinks** for major DEXes and explorers
- **Mod/admin tools** with role-gated commands
- **Automated Twitter/X announcements** and live voice channel price updates
- **Docker-ready** for easy self-hosting

---

## Getting Started

### 1. Clone the repo

```sh
git clone https://github.com/lewsales/discord-bot.git
cd discord-bot
```

### 2. Install dependencies

```sh
npm install
```

### 3. Configure environment

Copy the example env file and fill in your values:

```sh
cp .env.example .env
```

See `.env.example` for all required and optional variables with descriptions.

### 4. Set up the bot's Solana wallet

Generate a new keypair and fund it with a small amount of SOL for transaction fees:

```sh
solana-keygen new -o ./bot-keypair.json
```

> **Keep `bot-keypair.json` private. Never commit it. It is gitignored by default.**

### 5. Initialize runtime data files

The bot uses JSON files for persistent state. Create them from the templates:

```sh
cp registrations.example.json registrations.json
cp airdrops.example.json airdrops.json
cp faucet_claims.example.json faucet_claims.json
cp subscriptions.example.json subscriptions.json
```

### 6. Run the bot

```sh
npm start
```

For production, run under `pm2` or Docker for auto-restart on crash.

---

## Docker

```sh
docker build -t winlew-bot .
docker run --env-file .env winlew-bot
```

---

## Commands

**User Commands**
| Command | Description |
|---------|-------------|
| `!balance <address\|.sol>` | Check $WinLEW balance |
| `!faucet <address\|.sol>` | Claim free $WinLEW (once per 24h) |
| `!register <address\|.sol>` | Register for airdrops |
| `!price` | Current price (best source) |
| `!data` | Price from all sources (detailed) |
| `!gdata` | GeckoTerminal stats |
| `!ddata` | DexScreener stats |
| `!rdata` | Raydium stats |
| `!pdata` | Pump.fun stats |
| `!sdata` | Solscan stats |
| `!supply` | Total token supply |
| `!uptime` | Bot uptime |
| `!links` | All project links |
| `!quicklinks` | Fast access buy/swap/chart links |
| `!buy` `!dexscreener` `!swap` `!rugcheck` `!geckoterminal` `!cmc` `!website` | Direct links |
| `!help` | User help menu |

**Moderator/Admin Commands** *(requires your Discord ID in `MOD_IDS`)*
| Command | Description |
|---------|-------------|
| `!restart` | Restart the bot process |
| `!wallet` | Show bot's Solana address |
| `!debugprice` | Fetch and display all price source diagnostics |
| `!send <address\|.sol>` | Send tokens to an address (24h cooldown) |
| `!modhelp` | Admin help menu |

---

## Tech Stack

- **Node.js** (ESM modules)
- **Discord.js** v14
- **Solana web3.js** & SPL-Token
- **Raydium SDK** for pool data
- **dotenv** for configuration
- **node-cron** for scheduled updates
- **Twitter API v2** (optional, for announcement relaying)

---

## File Structure

```
.
├── bot.js                  # Main Discord bot logic
├── priceTracker.js         # Multi-source price aggregator with fallback
├── gecko.js                # GeckoTerminal price fetcher
├── raydium.js              # Raydium price fetcher
├── pumpfun.js              # Pump.fun price fetcher
├── dexscreener.js          # DexScreener price fetcher
├── solscan.js              # Solscan price fetcher
├── faucet.js               # Faucet/drip logic
├── sendWinlew.js           # Token sending helper
├── helpers.js              # Shared utilities
├── .env.example            # Environment variable template
├── bot-keypair.example.json  # Keypair file format reference
├── *.example.json          # Templates for runtime data files
└── Dockerfile
```

---

## Security Notes

- **Never commit `.env` or `bot-keypair.json`** — both are gitignored.
- Store the bot keypair somewhere secure and only fund it with what it needs for gas.
- Set `MOD_IDS` to only the Discord user IDs you trust with admin commands.
- For production, use a dedicated RPC endpoint (QuickNode, Helius, etc.) instead of the public mainnet node.

---

## Troubleshooting

**Bot doesn't start**: Run `npm start` and check the `.env loaded` output — any `❌ Rejected` line means a required env var is missing.

**Faucet fails**: Ensure the keypair wallet has SOL for transaction fees, and the `WINLEW_MINT` address is correct.

**Price commands return nothing**: Verify your pool/pair IDs in `.env` against each platform's UI for your token.

---

## Contributing

PRs, feature requests, and feedback are welcome. Open an issue or fork and submit a PR.

---

## Credits

- $WinLEW Community
- [LETS EVERYONE WIN Discord](https://discord.gg/7mZ2JP87JS)
- [Official Site](http://WinLEW.xyZ)

---

*Built with love by passionate builders for the #WinLEW fam.*
