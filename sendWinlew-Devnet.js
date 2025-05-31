// sendWinlew.js
const fs = require('fs');
const path = require('path');
const {
  Connection,
  PublicKey,
  Keypair,
  clusterApiUrl,
} = require('@solana/web3.js');
const {
  getOrCreateAssociatedTokenAccount,
  transfer,
} = require('@solana/spl-token');

// 1) Load your faucet wallet from ~/.config/solana/id.json
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

// 2) Set up the mint and connection
const WINLEW_MINT = new PublicKey(
  'DnrcdQVH7fdbmm4EyD7LjT9mNNozF5HuWMeKcpvjpump'
);
const connection = new Connection(
  clusterApiUrl('devnet'),
  'confirmed'
);

;(async () => {
  // 3) Grab & trim the recipient from argv
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: node sendWinlew.js <recipient_wallet>');
    process.exit(1);
  }
  const recipientStr = raw.trim();

  // 4) Validate / construct the PublicKey
  let recipient;
  try {
    recipient = new PublicKey(recipientStr);
  } catch (err) {
    console.error(
      `⛔ Invalid recipient address—make sure it’s pure Base58:\n> ${recipientStr}`
    );
    process.exit(1);
  }

  try {
    // 5) Derive or create token accounts
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      faucetWallet,
      WINLEW_MINT,
      faucetWallet.publicKey
    );
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      faucetWallet,
      WINLEW_MINT,
      recipient
    );

    // 6) Send 1 token ( adjust decimals to your mint )
    const amount = 1 * 10 ** 6;
    const signature = await transfer(
      connection,
      faucetWallet,
      fromTokenAccount.address,
      toTokenAccount.address,
      faucetWallet.publicKey,
      amount
    );

    console.log('✅ Sent $WinLEW! Tx Signature:', signature);
  } catch (err) {
    console.error('❌ Error sending tokens:', err);
    process.exit(1);
  }
})();
