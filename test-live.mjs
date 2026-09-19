import { readFile } from "node:fs/promises";

const map = JSON.parse(await readFile(new URL("./gorigins-old-mints-v2.json", import.meta.url), "utf8"));
const wallet = "HxmeRiRWSJcqzvsNucV76ZmuWjFjoXQkswMPqu2ezuJF";
const response = await fetch("https://rpc.gorbagana.wtf", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "getTokenAccountsByOwner",
    params: [
      wallet,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed", commitment: "finalized" }
    ]
  })
});
const rpc = await response.json();
if (rpc.error) throw new Error(rpc.error.message);
const holdings = rpc.result.value.flatMap((entry) => {
  const info = entry.account.data.parsed.info;
  const matched = map.mints[info.mint];
  return info.tokenAmount.amount === "1" && info.tokenAmount.decimals === 0 && Number.isInteger(matched?.number)
    ? [{ ...matched, mint: info.mint }]
    : [];
}).sort((a, b) => a.number - b.number);
if (JSON.stringify(holdings.map((item) => item.number)) !== JSON.stringify([1846, 4104])) {
  throw new Error(`Known-wallet result differs: ${JSON.stringify(holdings)}`);
}
console.log(JSON.stringify({ slot: rpc.result.context.slot, wallet, holdings }, null, 2));
