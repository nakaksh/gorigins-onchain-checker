# Gulag & Gorigins Wallet Checker

A static, read-only website that displays both current Gulag NFTs and restored Gorigins held directly by a Gorbagana wallet.

The browser calls Gorbagana's `getTokenAccountsByOwner` at finalized commitment and intersects the returned NFT mints with `gorigins-mints-v3.json`. The lookup contains all 4,445 verified Gulag mints and all 4,444 restored Gorigins mints, joined by the audited Gorigin number. It was derived from Gorbagana genesis `8MDnuYMWzFs7Pa6dBqBryvapuEtbGKgwCwbQ25NppS9h` and the immutable restoration manifest.

No wallet connection, signature, transaction, backend, analytics or allocation JSON is used.

## Run locally

```powershell
py -3 -m http.server 4173
```

Open `http://localhost:4173`.

## Independent on-chain check

Anyone can paste this into a browser developer console after replacing the wallet address. It reads finalized token accounts directly from the public Gorbagana RPC and prints every one-unit, zero-decimal token mint and token-account address. It does not use this website, Backpack, or a Midden API.

```js
(async wallet => { const response = await fetch("https://rpc.gorbagana.wtf", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner", params: [wallet, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed", commitment: "finalized" }] }) }); const body = await response.json(); if (body.error) throw new Error(body.error.message); const nfts = body.result.value.flatMap(({ pubkey, account }) => { const info = account?.data?.parsed?.info; return info?.tokenAmount?.amount === "1" && info?.tokenAmount?.decimals === 0 ? [{ mint: info.mint, tokenAccount: pubkey, owner: info.owner }] : []; }); console.log(`Finalized slot ${body.result.context.slot}`); console.table(nfts); return nfts; })("PASTE_WALLET_ADDRESS_HERE")
```

## Limitation

The checker displays NFTs held directly in the entered wallet at the returned finalized slot. Marketplace escrow NFTs are held by escrow accounts and do not appear under the seller's wallet.
