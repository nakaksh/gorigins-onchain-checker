import { readFile } from "node:fs/promises";

const map = JSON.parse(await readFile(new URL("./gorigins-mints-v3.json", import.meta.url), "utf8"));
if (map.schemaVersion !== 3 || Object.keys(map.items).length !== 4444 ||
    Object.keys(map.gulagMints).length !== 4445 || Object.keys(map.goriginMints).length !== 4444) {
  throw new Error("Lookup shape differs");
}
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
const holdings = rpc.result.value.reduce((result, entry) => {
  const info = entry.account.data.parsed.info;
  if (info.tokenAmount.amount !== "1" || info.tokenAmount.decimals !== 0) return result;
  const gulagNumber = map.gulagMints[info.mint];
  const goriginNumber = map.goriginMints[info.mint];
  if (Number.isInteger(gulagNumber)) result.gulag.push(gulagNumber);
  if (Number.isInteger(goriginNumber)) result.gorigins.push(goriginNumber);
  return result;
}, { gulag: [], gorigins: [] });
holdings.gulag.sort((a, b) => a - b);
holdings.gorigins.sort((a, b) => a - b);
if (JSON.stringify(holdings.gulag) !== JSON.stringify([1846, 4104]) ||
    JSON.stringify(holdings.gorigins) !== JSON.stringify([1846, 4104])) {
  throw new Error(`Known-wallet result differs: ${JSON.stringify(holdings)}`);
}
console.log(JSON.stringify({ slot: rpc.result.context.slot, wallet, holdings }, null, 2));
