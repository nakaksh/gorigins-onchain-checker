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
const mints = {};

for (const row of identities.rows) {
  const number = row.observedFileNumber;
  const restored = plan.items[number];
  const original = originals.get(number);
  if (!Number.isInteger(number) || !restored?.replacementMint || !original?.imageCid) {
    throw new Error(`Incomplete lookup data for ${row.mint}`);
  }
  mints[row.mint] = {
    number,
    restoredMint: restored.replacementMint,
    restoredImageUrl: `https://gateway.lighthouse.storage/ipfs/${original.imageCid}`,
    currentMetadataUrl: `https://gateway.lighthouse.storage/ipfs/bafybeiepi7twbdwjnczlzrh2lrausoqh3pdhzuf6nrll5grmjxmjcd4xsy/${number}.json`
  };
}

if (Object.keys(mints).length !== 4445) throw new Error("Expected 4,445 original mints");
const output = {
  schemaVersion: 2,
  description: "Old Gorigins mints, current Gulag numbers, and restored immutable counterparts.",
  sourceGenesis: identities.genesisHash,
  sourceSha256: createHash("sha256").update(identityBytes).digest("hex"),
  collectionMint: "GT8RwC8SowwEP5k7YLp59yXMJNpmCd7tgMHgdP7BA24S",
  mintCount: Object.keys(mints).length,
  mints: Object.fromEntries(Object.entries(mints).sort(([a], [b]) => a.localeCompare(b)))
};

await writeFile("gorigins-old-mints-v2.json", `${JSON.stringify(output)}\n`, "utf8");
console.log(JSON.stringify({ mintCount: output.mintCount, schemaVersion: output.schemaVersion }));
