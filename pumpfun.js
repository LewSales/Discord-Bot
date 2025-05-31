
// pumpfun.js
import fetch from 'node-fetch';
export const POOL_ID = 'DnrcdQVH7fdbmm4EyD7LjT9mNNozF5HuWMeKcpvjpump';


export async function fetchPumpFunPrice(id = POOL_ID) {
  const url = `https://api.pump.fun/api/markets/${id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pump.Fun HTTP ${res.status}`);
  const json = await res.json();
  const price = Number(json.price);
  if (!price || isNaN(price)) throw new Error('No valid price from Pump.fun');
  return {
    price,
    baseSymbol: json.data?.attributes?.base_token_symbol,
    baseAddress: json.data?.attributes?.base_token_address,
    quoteSymbol: json.data?.attributes?.quote_token_symbol,
    volume24h: json.data?.attributes?.volume_usd_24h,
    fdv: json.data?.attributes?.fdv_usd,
    url: `<https://pump.fun/coin/${id}>`,
  };
}
