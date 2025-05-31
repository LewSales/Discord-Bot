#!/usr/bin/env node
// sendEithertoken.js

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
  TOKEN_2022_PROGRAM_ID,          // ← import this
  ASSOCIATED_TOKEN_PROGRAM_ID,    // ← and this
} = require('@solana/spl-token');










// ─── Helper to load a Keypair from ~/.config/solana/<file> ─────────────
function loadKeypair(filename) {
  const p = path.join(
    process.env.HOME || process.env.USERPROFILE,
    '.config', 'solana', filename
  );
  if (!fs.existsSync(p)) {
    console.error(`⛔ Keypair file not found: ${p}`);
    process.exit(1);
  }
  const secret = JSON.parse(fs.readFileSync(p, 'utf8'));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

// ─── 1) Load both faucet keypairs & define both mints ────────────────────
const FAUCET_WINLEW   = loadKeypair('id_winlew.json');
const FAUCET_SPLTOKEN = loadKeypair('id_spltoken.json');

const WINLEW_MINT   = new PublicKey('DnrcdQVH7fdbmm4EyD7LjT9mNNozF5HuWMeKcpvjpump');
const SPLTOKEN_MINT = new PublicKey('6F53Ywxpmzq7F9fusLfBks6cZyhNAn7YYPMbR8qSqpqe');

const DECIMALS_WINLEW   = 6;
const DECIMALS_SPLTOKEN = 6;

// ─── 2) Connect to Devnet ────────────────────────────────────────────────
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// ─── 3) Parse CLI args ──────────────────────────────────────────────────
// Usage: node sendEithertoken.js <recipient> <amount> [winlew|spltoken]
const [,, rawRecipient, rawAmount, rawToken = 'winlew'] = process.argv;
if (!rawRecipient || !rawAmount) {
  console.error('Usage: node sendEithertoken.js <recipient_pubkey> <amount> [winlew|spltoken]');
  process.exit(1);
}

// Validate recipient Pubkey
let recipient;
try {
  recipient = new PublicKey(rawRecipient);
} catch (e) {
  console.error('⛔ Invalid recipient pubkey:', e.message);
  process.exit(1);
}

// Parse amount
const amountTokens = Number(rawAmount);
if (isNaN(amountTokens) || amountTokens <= 0) {
  console.error('⛔ Invalid amount:', rawAmount);
  process.exit(1);
}

// ─── 4) Select which token & faucet to use ───────────────────────────────
let faucetKeypair, mintPubkey, decimals, tokenName;
switch (rawToken.toLowerCase()) {
  case 'spltoken':
    faucetKeypair = FAUCET_SPLTOKEN;
    mintPubkey    = SPLTOKEN_MINT;
    decimals      = DECIMALS_SPLTOKEN;
    tokenName     = 'SPLTOKEN';
    break;
  case 'winlew':
  default:
    faucetKeypair = FAUCET_WINLEW;
    mintPubkey    = WINLEW_MINT;
    decimals      = DECIMALS_WINLEW;
    tokenName     = 'WinLEW';
}

// ─── 5) Build & send via high‑level helpers ───────────────────────────────
;(async () => {
  try {
    // a) Ensure the faucet’s ATA exists, _using the 2022 program_
    const fromAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      faucetKeypair,              // payer & fee-payer
      mintPubkey,                 // your Token‑2022 mint
      faucetKeypair.publicKey,    // owner of this ATA
      false,                      // allowOwnerOffCurve?
      'confirmed',                // commitment
      undefined,                  // confirmOptions
      TOKEN_2022_PROGRAM_ID,      // ← override token program
      ASSOCIATED_TOKEN_PROGRAM_ID // ← override associated-token program
    );

    // b) Same for the recipient
    const toAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      faucetKeypair,
      mintPubkey,
      recipient,
      false,
      'confirmed',
      undefined,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // c) Transfer as before…
    const rawUnits = Math.floor(amountTokens * 10 ** decimals);
    const signature = await transfer(
      connection,
      faucetKeypair,
      fromAccount.address,
      toAccount.address,
      faucetKeypair.publicKey,
      rawUnits,
      [],                        // multisig signers, if any
      {                             // override the program here too!
        programId: TOKEN_2022_PROGRAM_ID
      }
    );

    console.log(`✅ Sent ${amountTokens} ${tokenName} to ${recipient.toBase58()}`);
    console.log('Signature:', signature);
  } catch (err) {
    console.error('❌ Error sending tokens:', err.message || err);
    process.exit(1);
  }
})();