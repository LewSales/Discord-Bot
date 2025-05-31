// sendWinlew.js
import fs from 'fs';
import path from 'path';
import {
  Connection,
  PublicKey,
  Keypair,
  clusterApiUrl,
} from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
} from '@solana/spl-token';

// 1) Load your mainnet faucet wallet
const idPath = path.join(
  process.env.HOME || process.env.USERPROFILE,
  '.config',
  'solana',
  'id.json'
);
if (!fs.existsSync(idPath)) {
  console.error(`⛔ Keypair file not found at ${idPath}`);
  process.exit(1);
}
const secretKey = Uint8Array.from(
  JSON.parse(fs.readFileSync(idPath, 'utf8'))
);
const faucetWallet = Keypair.fromSecretKey(secretKey);

// 2) Connect to Mainnet-Beta
const connection = new Connection(
  clusterApiUrl('mainnet-beta'),
  'confirmed'
);

// 3) Your mint
const WINLEW_MINT = new PublicKey(
  'DnrcdQVH7fdbmm4EyD7LjT9mNNozF5HuWMeKcpvjpump'
);

(async () => {
  // 4) Grab & validate recipient
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: node sendWinlew.js <recipient_wallet>');
    process.exit(1);
  }
  let recipient;
  try {
    recipient = new PublicKey(raw.trim());
  } catch {
    console.error(`⛔ Invalid address: ${raw}`);
    process.exit(1);
  }

  try {
    // 5) Find or create associated token accounts
    const fromAta = await getOrCreateAssociatedTokenAccount(
      connection,
      faucetWallet,
      WINLEW_MINT,
      faucetWallet.publicKey
    );
    const toAta = await getOrCreateAssociatedTokenAccount(
      connection,
      faucetWallet,
      WINLEW_MINT,
      recipient
    );

    // 6) Send 1 $WinLEW (adjust for your decimals)
    const amount = 1 * 10 ** 6;
    const sig = await transfer(
      connection,
      faucetWallet,
      fromAta.address,
      toAta.address,
      faucetWallet.publicKey,
      amount
    );

    console.log('✅ Sent $WinLEW on Mainnet! Tx:', sig);
  } catch (err) {
    console.error('❌ Error sending tokens:', err);
    process.exit(1);
  }
})();
