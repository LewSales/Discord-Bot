
// raydium.js

import fetch from 'node-fetch';

export const POOL_ID = '5nTz6Cq7U54TArLEFMgFUatcZXh5NG9BVrecqMrJ92Lx';

export async function fetchRaydiumPrice(id = POOL_ID) {
  const url = `https://api-v3.raydium.io/pools/info/ids?ids=${id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Raydium HTTP ${res.status}`);
  const json = await res.json();
  const data = json[id];
  if (!data || !data.price) throw new Error('No valid price from Raydium');
  return {
    price: Number(data.price),
    poolName: data.name || 'SOL/WinLEW',
    baseSymbol: data.base?.symbol,
    baseAddress: data.base?.mint,
    quoteSymbol: data.quote?.symbol,
    volume24h: data.volume24h,
    tvl: data.tvl,
    url: `<https://raydium.io/swap/?inputCurrency=sol&outputCurrency=DnrcdQVH7fdbmm4EyD7LjT9mNNozF5HuWMeKcpvjpump>`,
  };
}