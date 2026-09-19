# Old Gorigins Wallet Checker

A static, read-only website that displays old Gorigins held directly by a Gorbagana wallet.

The browser calls Gorbagana's `getTokenAccountsByOwner` at finalized commitment and intersects the returned NFT mints with `gorigins-old-mints.json`. The lookup contains all 4,445 verified old collection mints and their current Gulag metadata numbers, derived from Gorbagana genesis `8MDnuYMWzFs7Pa6dBqBryvapuEtbGKgwCwbQ25NppS9h`.

No wallet connection, signature, transaction, backend, analytics or allocation JSON is used.

## Run locally

```powershell
py -3 -m http.server 4173
```

Open `http://localhost:4173`.

## Limitation

The checker displays NFTs held directly in the entered wallet at the returned finalized slot. Marketplace escrow NFTs are held by escrow accounts and do not appear under the seller's wallet.
