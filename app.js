const RPC_URL = "https://rpc.gorbagana.wtf";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const EXPLORER = "https://explorer.gorbagana.wtf/address/";
const BASE58_WALLET = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const form = document.querySelector("#checker-form");
const walletInput = document.querySelector("#wallet");
const checkButton = document.querySelector("#check-button");
const status = document.querySelector("#status");
const results = document.querySelector("#results");
const resultTitle = document.querySelector("#result-title");
const resultWallet = document.querySelector("#result-wallet");
const resultSlot = document.querySelector("#result-slot");
const gulagList = document.querySelector("#gulag-holdings");
const goriginList = document.querySelector("#gorigin-holdings");
const gulagTitle = document.querySelector("#gulag-title");
const goriginTitle = document.querySelector("#gorigin-title");
const downloadButton = document.querySelector("#download-button");

let lastResult = null;
let mintMapPromise;

function loadMintMap() {
  mintMapPromise ??= fetch("gorigins-mints-v3.json", { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) throw new Error("The verified Gorigins mint list is unavailable.");
      return response.json();
    })
    .then((data) => {
      if (data.schemaVersion !== 3 || Object.keys(data.items || {}).length !== 4444 ||
          Object.keys(data.gulagMints || {}).length !== 4445 || Object.keys(data.goriginMints || {}).length !== 4444) {
        throw new Error("The verified Gorigins mint list failed validation.");
      }
      return data;
    });
  return mintMapPromise;
}

async function readTokenAccounts(wallet) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [
        wallet,
        { programId: TOKEN_PROGRAM },
        { encoding: "jsonParsed", commitment: "finalized" }
      ]
    })
  });
  if (!response.ok) throw new Error(`Gorbagana RPC returned HTTP ${response.status}.`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "Gorbagana RPC rejected the request.");
  if (!Array.isArray(data.result?.value)) throw new Error("Gorbagana RPC returned an unexpected response.");
  return data.result;
}

function selectHoldings(tokenAccounts, map) {
  const seen = new Set();
  const holdings = { gulag: [], gorigins: [] };
  for (const entry of tokenAccounts) {
    const info = entry?.account?.data?.parsed?.info;
    const mint = info?.mint;
    const amount = String(info?.tokenAmount?.amount ?? "");
    const decimals = Number(info?.tokenAmount?.decimals);
    if (amount !== "1" || decimals !== 0 || seen.has(mint)) continue;
    const gulagNumber = map.gulagMints[mint];
    const goriginNumber = map.goriginMints[mint];
    const type = Number.isInteger(gulagNumber) ? "gulag" : Number.isInteger(goriginNumber) ? "gorigins" : null;
    const number = type === "gulag" ? gulagNumber : goriginNumber;
    const matched = map.items[number];
    if (!type || !matched || matched.number !== number) continue;
    seen.add(mint);
    holdings[type].push({ ...matched, mint, tokenAccount: entry.pubkey, type });
  }
  for (const values of Object.values(holdings)) {
    values.sort((a, b) => a.number - b.number || a.mint.localeCompare(b.mint));
  }
  return holdings;
}

function gatewayUrl(url) {
  const marker = "/ipfs/";
  const index = String(url || "").indexOf(marker);
  return index >= 0 ? `https://gateway.lighthouse.storage/ipfs/${String(url).slice(index + marker.length)}` : url;
}

async function loadCurrentArtwork(holding, image, fallback) {
  try {
    const response = await fetch(holding.currentMetadataUrl, { cache: "force-cache" });
    if (!response.ok) throw new Error("metadata unavailable");
    const metadata = await response.json();
    if (typeof metadata.image !== "string" || !metadata.image) throw new Error("image unavailable");
    image.src = gatewayUrl(metadata.image);
  } catch {
    image.hidden = true;
    fallback.hidden = false;
  }
}

function renderCollection(list, holdings, emptyMessage, showGulagArtwork) {
  list.replaceChildren();
  if (holdings.length === 0) {
    const row = document.createElement("li");
    row.className = "empty";
    row.textContent = emptyMessage;
    list.append(row);
  } else {
    for (const holding of holdings) {
      const row = document.createElement("li");
      const artwork = document.createElement("div");
      artwork.className = "artwork-pair";
      const restoredArt = document.createElement("figure");
      const restoredImage = document.createElement("img");
      restoredImage.src = holding.restoredImageUrl;
      restoredImage.alt = `Restored Gorigin #${holding.number} artwork`;
      restoredImage.loading = "lazy";
      restoredArt.append(restoredImage, Object.assign(document.createElement("figcaption"), { textContent: "Restored Gorigin artwork" }));
      if (showGulagArtwork) {
        const currentArt = document.createElement("figure");
        const currentImage = document.createElement("img");
        const currentFallback = document.createElement("div");
        currentFallback.className = "image-fallback";
        currentFallback.textContent = "Current artwork unavailable";
        currentFallback.hidden = true;
        currentImage.alt = `Current Gulag #${holding.number} artwork`;
        currentImage.loading = "lazy";
        currentArt.append(currentImage, currentFallback, Object.assign(document.createElement("figcaption"), { textContent: "Current Gulag artwork" }));
        artwork.append(currentArt);
        void loadCurrentArtwork(holding, currentImage, currentFallback);
      }
      artwork.append(restoredArt);

      const details = document.createElement("div");
      details.className = "holding-details";
      const title = document.createElement("strong");
      const match = document.createElement("span");
      const links = document.createElement("div");
      links.className = "mint-links";
      const restoredMint = document.createElement("a");
      title.textContent = `${holding.type === "gulag" ? "Gulag" : "Gorigin"} #${holding.number}`;
      match.textContent = holding.type === "gulag"
        ? `Matches restored Gorigin #${holding.number}`
        : `Restored Gorigin #${holding.number} held by this wallet`;
      restoredMint.textContent = `Restored Gorigin mint: ${holding.restoredMint}`;
      restoredMint.href = `${EXPLORER}${holding.restoredMint}`;
      const linkedGulagMints = holding.type === "gulag" ? [holding.mint] : holding.gulagMints;
      const mintLinks = linkedGulagMints.map((mint, index) => {
        const link = document.createElement("a");
        link.textContent = `${linkedGulagMints.length > 1 ? `Matching Gulag mint ${index + 1}` : "Gulag mint"}: ${mint}`;
        link.href = `${EXPLORER}${mint}`;
        return link;
      });
      for (const link of [...mintLinks, restoredMint]) {
        link.target = "_blank";
        link.rel = "noreferrer";
      }
      links.append(...mintLinks, restoredMint);
      details.append(title, match, links);
      row.append(artwork, details);
      list.append(row);
    }
  }
}

function render(result) {
  lastResult = result;
  const total = result.holdings.gulag.length + result.holdings.gorigins.length;
  resultTitle.textContent = `${total} matching NFT${total === 1 ? "" : "s"} held directly`;
  resultWallet.textContent = result.wallet;
  resultSlot.textContent = `Finalized slot ${Number(result.slot).toLocaleString()}`;
  gulagTitle.textContent = `Gulag NFTs (${result.holdings.gulag.length})`;
  goriginTitle.textContent = `Restored Gorigins (${result.holdings.gorigins.length})`;
  renderCollection(gulagList, result.holdings.gulag,
    "No Gulag NFTs are held directly by this wallet at this finalized slot.", true);
  renderCollection(goriginList, result.holdings.gorigins,
    "No restored Gorigins are held directly by this wallet at this finalized slot.", false);
  results.hidden = false;
  downloadButton.hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const wallet = walletInput.value.trim();
  results.hidden = true;
  downloadButton.hidden = true;
  status.className = "";
  if (!BASE58_WALLET.test(wallet)) {
    status.textContent = "Enter a valid Gorbagana wallet address.";
    status.className = "error";
    return;
  }

  checkButton.disabled = true;
  checkButton.textContent = "Reading chain…";
  status.textContent = "Reading finalized token accounts from Gorbagana…";
  try {
    const [map, tokenResult] = await Promise.all([loadMintMap(), readTokenAccounts(wallet)]);
    const holdings = selectHoldings(tokenResult.value, map);
    const result = {
      wallet,
      finalizedSlot: tokenResult.context.slot,
      checkedAt: new Date().toISOString(),
      sourceGenesis: map.sourceGenesis,
      holdings
    };
    history.replaceState(null, "", `?wallet=${encodeURIComponent(wallet)}`);
    render({ ...result, slot: result.finalizedSlot });
    status.textContent = "Live finalized read complete.";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Could not read Gorbagana right now.";
    status.className = "error";
  } finally {
    checkButton.disabled = false;
    checkButton.textContent = "Check wallet";
  }
});

downloadButton.addEventListener("click", () => {
  if (!lastResult) return;
  const blob = new Blob([`${JSON.stringify(lastResult, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `gorigins-${lastResult.wallet}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
});

const initialWallet = new URLSearchParams(location.search).get("wallet");
if (initialWallet) walletInput.value = initialWallet;
