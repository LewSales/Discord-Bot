// webhook.js
import { fetchRaydiumPrice } from './raydium.js';
import { fetchPumpFunPrice } from './pumpfun.js';

import { Client, GatewayIntentBits, WebhookClient } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// A WebhookClient lets you reuse your existing webhook URL:
const webhookClient = new WebhookClient({ url: process.env.DISCORD_WEBHOOK_URL });

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // ignore bots (including itself)
  if (message.author.bot) return;

  // 1) Command to display your webhook URL
  if (message.content === '!webhook') {
    return message.reply(`Here’s the webhook URL I’m using:\n\`${process.env.DISCORD_WEBHOOK_URL}\``);
  }

  // 2) Command to send a test via webhook
  if (message.content === '!testwebhook') {
    await webhookClient.send({
      content: `👋 Hello from the webhook!`
    });
    return message.reply('Sent a test message via webhook!');
  }

  // 3) (Optional) Command to post a price alert on demand
  if (message.content === '!price') {
    // assume you’ve exported your fetchers from priceTracker.js:
    const { fetchRaydiumPrice } = await import('./raydium.js');
    const { fetchPumpFunPrice } = await import('./pumpfun.js');
    try {
      const [ray, pump] = await Promise.all([
        fetchRaydiumPrice(),
        fetchPumpFunPrice()
      ]);
      return message.reply(`🏷️ Prices:\n• Raydium: $${ray.toFixed(6)}\n• PumpFun: $${pump.toFixed(6)}`);
    } catch (err) {
      console.error(err);
      return message.reply('❌ Failed to fetch prices.');
    }
  }
});

// log in the bot
client.login(process.env.DISCORD_BOT_TOKEN);
