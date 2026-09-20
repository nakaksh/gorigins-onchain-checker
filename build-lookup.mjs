import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const evidenceRoot = resolve(process.argv[2] || "../Midden-Gorigins-Recovery");
const artifactRoot = resolve(evidenceRoot, "artifacts", "gorigins-relaunch");
const identityPath = resolve(artifactRoot, "gorbagana-genesis-identities-20260918.json");
const identityBytes = await readFile(identityPath);
const identities = JSON.parse(identityBytes);
const plan = JSON.parse(await readFile(resolve(artifactRoot, "reserved-mint-plan.json")));
const metadata = JSON.parse(await readFile(resolve(artifactRoot, "metadata-index.json")));
const originals = new Map(metadata.files.map((item) => [item.id, item]));
const items = {};
const gulagMints = {};
const goriginMints = {};

for (const row of identities.rows) {
  const number = row.observedFileNumber;
  const restored = plan.items[number];
  const original = originals.get(number);
  if (!Number.isInteger(number) || !restored?.replacementMint || !original?.imageCid) {
    throw new Error(`Incomplete lookup data for ${row.mint}`);
  }
  const item = items[number] ??= {
    number,
    restoredMint: restored.replacementMint,
    restoredImageUrl: `https://gateway.lighthouse.storage/ipfs/${original.imageCid}`,
    currentMetadataUrl: `https://gateway.lighthouse.storage/ipfs/bafybeiepi7twbdwjnczlzrh2lrausoqh3pdhzuf6nrll5grmjxmjcd4xsy/${number}.json`,
    gulagMints: []
  };
  if (item.restoredMint !== restored.replacementMint) throw new Error(`Conflicting restored mint for #${number}`);
  item.gulagMints.push(row.mint);
  gulagMints[row.mint] = number;
  goriginMints[restored.replacementMint] = number;
}

if (Object.keys(items).length !== 4444) throw new Error("Expected 4,444 numbered items");
if (Object.keys(gulagMints).length !== 4445) throw new Error("Expected 4,445 Gulag mints");
if (Object.keys(goriginMints).length !== 4444) throw new Error("Expected 4,444 restored Gorigin mints");
for (const item of Object.values(items)) item.gulagMints.sort();
const output = {
  schemaVersion: 3,
  description: "On-chain Gulag and restored Gorigins mint indexes joined by the audited Gorigin number.",
  sourceGenesis: identities.genesisHash,
  sourceSha256: createHash("sha256").update(identityBytes).digest("hex"),
  collections: {
    gulag: { mint: "GT8RwC8SowwEP5k7YLp59yXMJNpmCd7tgMHgdP7BA24S", mintCount: 4445 },
    gorigins: { mint: "8tJSQyaA4gGRdn5GHRN7FSpsX3XagfXPn4KvGQmC7HWU", mintCount: 4444 }
  },
  items: Object.fromEntries(Object.entries(items).sort(([a], [b]) => Number(a) - Number(b))),
  gulagMints: Object.fromEntries(Object.entries(gulagMints).sort(([a], [b]) => a.localeCompare(b))),
  goriginMints: Object.fromEntries(Object.entries(goriginMints).sort(([a], [b]) => a.localeCompare(b)))
};

await writeFile("gorigins-mints-v3.json", `${JSON.stringify(output)}\n`, "utf8");
console.log(JSON.stringify({
  schemaVersion: output.schemaVersion,
  items: Object.keys(output.items).length,
  gulagMints: Object.keys(output.gulagMints).length,
  goriginMints: Object.keys(output.goriginMints).length
}));
