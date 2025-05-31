import dotenv from 'dotenv';
dotenv.config();

import { PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  transfer
} from '@solana/spl-token';

// SAFETY CHECKS
if (!process.env.WINLEW_MINT) {
  throw new Error("Missing WINLEW_MINT in .env!");
}
const TOKEN_MINT = new PublicKey(process.env.WINLEW_MINT);

const DRIP_AMOUNT = Number(process.env.DRIP_AMOUNT) || 1000;
if (isNaN(DRIP_AMOUNT) || DRIP_AMOUNT <= 0) {
  throw new Error("Invalid DRIP_AMOUNT in .env! It must be a positive number.");
}

export async function dripTokens(connection, payerKeypair, recipientPubkey) {
  // 1. Find payer’s and recipient’s token accounts:
  const fromAta = await getAssociatedTokenAddress(
    TOKEN_MINT,
    payerKeypair.publicKey
  );
  const toAta = await getAssociatedTokenAddress(
    TOKEN_MINT,
    recipientPubkey
  );

  // 2. Move the tokens (will throw if recipient box doesn't exist):
  const signature = await transfer(
    connection,
    payerKeypair,          
    fromAta,               
    toAta,                 
    payerKeypair.publicKey,
    DRIP_AMOUNT * 10 ** 6   // use DRIP_AMOUNT here
  );

  console.log(`Sent ${DRIP_AMOUNT} $WinLEW →`, toAta.toBase58());
  return signature;
}
