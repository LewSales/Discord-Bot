
// solscan.js
import fetch from 'node-fetch';

export const API_KEY = process.env.SOLSCAN_API_KEY;
export const POOL_ID = '5nTz6Cq7U54TArLEFMgFUatcZXh5NG9BVrecqMrJ92Lx';

export async function fetchSolScanPrice(id = POOL_ID) {
  const url = `https://pro-api.solscan.io/v2.0/token/price?address=${id}`;
  const res = await fetch(url, {
    headers: { Authorization: API_KEY }
  });
  if (!res.ok) throw new Error(`Solscan HTTP ${res.status}`);
  const json = await res.json();
  const price = Number(json?.data?.priceUsdt);
  if (!price || isNaN(price)) throw new Error('No valid price from Solscan');
  return {
    price,
    symbol: json.data?.symbol,
    url: `<https://solscan.io/token/${id}>`,
  };
}
