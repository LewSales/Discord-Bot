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

// Connect to MainNET
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

async function main() {
  const publicKey = keypair.publicKey;
  console.log('Public Key:', publicKey.toBase58());

  // Check balance
  let balance = await connection.getBalance(publicKey);
  console.log('Initial balance:', balance / LAMPORTS_PER_SOL, 'SOL');

}

main().catch(console.error);
