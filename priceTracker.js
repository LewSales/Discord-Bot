// priceTracker.js
import dotenv from 'dotenv';
dotenv.config();

import { fetchGeckoTerminalPrice } from './gecko.js';
import { fetchRaydiumPrice } from './raydium.js';
import { fetchPumpFunPrice } from './pumpfun.js';
import { fetchDexScreenerPrice } from './dexscreener.js';
import { fetchSolScanPrice } from './solscan.js';

// ─── Gather All Relevant IDs from .env ──────────────────────────────
const {
  WINLEW_MINT,
  WINLEW_POOL_ID,
  WINLEW2_POOL_ID,
  RAYDIUM_POOL_ID,
  PUMPFUN_POOL_ID,
  DEXSCREENER_PAIR_ID,
  GECKO_PAIR_ID,
  SOLSCAN_RAYDIUM_ID,
  SOLSCAN_PUMP_ID,
  SOLSCAN_API_KEY,
} = process.env;

// Helper: unique and filter out empty values
const uniq = arr => [...new Set(arr.filter(Boolean))];

// ─── Helper to Try Multiple IDs for a Single Source ─────────────────
async function tryFetchWithIds(label, fetcher, ids) {
  for (const id of uniq(ids)) {
    try {
      const result = await fetcher(id);
      const price = result?.price || result; // Support both shape { price } and direct value
      if (price && !isNaN(price) && price > 0) {
        console.log(`✅ [${label}] ${id}: $${price}`);
        return { ...result, price, id, source: label };
      }
    } catch (e) {
      console.warn(`❌ [${label}] ${id}: ${e.message}`);
    }
  }
  throw new Error(`All [${label}] IDs failed`);
}

// ─── Main Fetch Best Price: Tries All Sources and IDs ───────────────
export async function fetchBestPrice() {
  // Add/remove/adjust IDs to match your .env and preference
  const geckoIds = uniq([GECKO_PAIR_ID, RAYDIUM_POOL_ID, WINLEW_POOL_ID, WINLEW2_POOL_ID]);
  const solscanIds = uniq([WINLEW_MINT, SOLSCAN_RAYDIUM_ID, SOLSCAN_PUMP_ID]);
  const raydiumIds = uniq([RAYDIUM_POOL_ID, WINLEW2_POOL_ID, WINLEW_POOL_ID]);
  const pumpfunIds = uniq([PUMPFUN_POOL_ID, WINLEW2_POOL_ID, WINLEW_POOL_ID]);
  const dexscreenerIds = uniq([DEXSCREENER_PAIR_ID, WINLEW2_POOL_ID, WINLEW_POOL_ID]);

  // Fallback between sources, trying all IDs for each
  try {
    return await tryFetchWithIds('GeckoTerminal', fetchGeckoTerminalPrice, geckoIds);
  } catch {}
   try {
     return await tryFetchWithIds('SolScan', fetchSolScanPrice, solscanIds);
   } catch {}
  try {
    return await tryFetchWithIds('Raydium', fetchRaydiumPrice, raydiumIds);
  } catch {}
  try {
    return await tryFetchWithIds('PumpFun', fetchPumpFunPrice, pumpfunIds);
  } catch {}
  try {
    return await tryFetchWithIds('DexScreener', fetchDexScreenerPrice, dexscreenerIds);
  } catch {}

  throw new Error('All price sources and IDs failed!');
}

// ─── Manual Source Fetch (with fallback to dynamic import) ──────────
export async function fetchPriceBySource(sourceName, id) {
  switch (sourceName.toLowerCase()) {
    case 'gecko':
    case 'geckoterminal':
      return await tryFetchWithIds('GeckoTerminal', fetchGeckoTerminalPrice, id ? [id] : uniq([GECKO_PAIR_ID, RAYDIUM_POOL_ID, WINLEW_POOL_ID, WINLEW2_POOL_ID]));
    case 'raydium':
      return await tryFetchWithIds('Raydium', fetchRaydiumPrice, id ? [id] : uniq([RAYDIUM_POOL_ID, WINLEW2_POOL_ID, WINLEW_POOL_ID]));
    case 'pumpfun':
      return await tryFetchWithIds('PumpFun', fetchPumpFunPrice, id ? [id] : uniq([PUMPFUN_POOL_ID, WINLEW2_POOL_ID, WINLEW_POOL_ID]));
    case 'dexscreener':
      return await tryFetchWithIds('DexScreener', fetchDexScreenerPrice, id ? [id] : uniq([DEXSCREENER_PAIR_ID, WINLEW2_POOL_ID, WINLEW_POOL_ID]));
   case 'solscan':
      return await tryFetchWithIds('SolScan', fetchSolScanPrice, id ? [id] : solscanIds);
    default:
      // Dynamic import fallback
      return await fetchFromDynamicSource(sourceName, id);
  }
}

// ─── Dynamic Import Fallback ───────────────
export async function fetchFromDynamicSource(source, id) {
  try {
    const mod = await import(`./${source}.js`);
    const fetchFn = mod[Object.keys(mod).find(k => k.startsWith('fetch') && k.endsWith('Price'))];
    if (!fetchFn) throw new Error('No valid fetch function found');
    const res = await fetchFn(id);
    const price = res?.price || res;
    if (price && !isNaN(price) && price > 0) {
      return { ...res, price, id, source };
    }
    throw new Error('Returned invalid price');
  } catch (err) {
    throw new Error(`Dynamic fetch for "${source}" failed: ${err.message}`);
  }
}
