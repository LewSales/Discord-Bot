import dotenv from "dotenv";
dotenv.config();

import { Connection, clusterApiUrl } from "@solana/web3.js";
import { getDomainKey, getDomainKeySync, NameRegistryState } from "@bonfida/spl-name-service";

const connection = new Connection(process.env.RPC_URL || clusterApiUrl("mainnet-beta"));
const domain = "lewsales"; // without .sol

(async () => {
  try {
    const { pubkey } = await getDomainKeySync(domain);
    const registry = await NameRegistryState.retrieve(connection, pubkey);
    console.log("SNS .sol registry owner:", registry.owner.toBase58());
  } catch (err) {
    console.error("SNS ERROR:", err);
  }
})();
