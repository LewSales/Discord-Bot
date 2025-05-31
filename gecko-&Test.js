// gecko.js
import fetch from 'node-fetch';

export const POOL_ID = '5nTz6Cq7U54TArLEFMgFUatcZXh5NG9BVrecqMrJ92Lx';

export async function fetchGeckoTerminalPrice(id = POOL_ID) {
  const url = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GeckoTerminal HTTP ${res.status}`);
  const json = await res.json();
  // Debug log full response
  // console.log('[GeckoTerminal] API response:', JSON.stringify(json, null, 2));
  const price = Number(json.data?.attributes?.base_token_price_usd);
  if (!price || isNaN(price)) throw new Error('No valid price from GeckoTerminal');
  return {
    price,
    poolName: json.data?.attributes?.name || 'N/A',
    baseSymbol: json.data?.attributes?.base_token_symbol,
    baseAddress: json.data?.attributes?.base_token_address,
    quoteSymbol: json.data?.attributes?.quote_token_symbol,
    volume24h: json.data?.attributes?.volume_usd_24h,
    fdv: json.data?.attributes?.fdv_usd,
    url: `https://www.geckoterminal.com/solana/pools/${id}`,
  };
}

// OPTIONAL: test runner, runs only if called directly (not when imported)
if (process.argv[1] === new URL(import.meta.url).pathname) {
  (async () => {
    try {
      const info = await fetchGeckoTerminalPrice();
      console.log(`$WINLEW price: $${info.price}`);
      console.log(info);
    } catch (err) {
      console.error('Error:', err.message);
    }
  })();
}
