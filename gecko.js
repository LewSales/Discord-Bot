// gecko.js
import fetch from 'node-fetch';

export const POOL_ID = '5nTz6Cq7U54TArLEFMgFUatcZXh5NG9BVrecqMrJ92Lx';

export async function fetchGeckoTerminalPrice(id = POOL_ID) {
  const url = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GeckoTerminal HTTP ${res.status}`);
  const json = await res.json();
  const price = Number(json.data?.attributes?.base_token_price_usd);
  if (!price || isNaN(price)) throw new Error('No valid price from GeckoTerminal');
  return {
    price,
    poolName: json.data?.attributes?.name || 'SOL/WINLEW',
    baseSymbol: json.data?.attributes?.base_token_symbol,
    baseAddress: json.data?.attributes?.base_token_address,
    quoteSymbol: json.data?.attributes?.quote_token_symbol,
    volume24h: json.data?.attributes?.volume_usd_24h,
    fdv: json.data?.attributes?.fdv_usd,
    url: `<https://www.geckoterminal.com/solana/pools/${id}>`,
  };
}
