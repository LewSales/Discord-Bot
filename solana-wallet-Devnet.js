import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  clusterApiUrl,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';

// Load the private key array from keypair.json
const secret = JSON.parse(fs.readFileSync('./bot-keypair.json', 'utf8'));
const keypair = Keypair.fromSecretKey(new Uint8Array(secret));

// Connect to Devnet
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');



async function main() {
  const publicKey = keypair.publicKey;
  console.log('Public Key:', publicKey.toBase58());

  // Check balance
  let balance = await connection.getBalance(publicKey);
  console.log('Initial balance:', balance / LAMPORTS_PER_SOL, 'SOL');

  // If balance is low, request airdrop
  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.log('Requesting airdrop...');
    const sig = await connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, 'confirmed');
    balance = await connection.getBalance(publicKey);
    console.log('New balance:', balance / LAMPORTS_PER_SOL, 'SOL');
  } else {
    console.log('Wallet already funded.');
  }
}

main().catch(console.error);
