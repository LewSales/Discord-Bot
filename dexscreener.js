
// dexscreener.js
import fetch from 'node-fetch';

export const POOL_ID = 'h3hoytv5tg6a2uzqsjhncidgwcwx4h3kdnewfjmlmgfg';

export async function fetchDexScreenerPrice(id = POOL_ID) {
  const url = `https://api.dexscreener.com/latest/dex/pairs/solana/${id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DexScreener HTTP ${res.status}`);
  const json = await res.json();
  const price = Number(json.pair?.priceUsd);
  if (!price || isNaN(price)) throw new Error('No valid price from DexScreener');
  return {
    price,
    baseSymbol: json.pair?.baseToken?.symbol,
    quoteSymbol: json.pair?.quoteToken?.symbol,
    url: `<https://dexscreener.com/solana/${id}>`,
  };
}
