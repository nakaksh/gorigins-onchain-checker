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
const holdingsList = document.querySelector("#holdings");
const downloadButton = document.querySelector("#download-button");

let lastResult = null;
let mintMapPromise;

function loadMintMap() {
  mintMapPromise ??= fetch("gorigins-old-mints.json", { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) throw new Error("The verified Gorigins mint list is unavailable.");
      return response.json();
    })
    .then((data) => {
      if (data.mintCount !== 4445 || Object.keys(data.mints || {}).length !== 4445) {
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

function selectHoldings(tokenAccounts, mintNumbers) {
  const seen = new Set();
  return tokenAccounts.flatMap((entry) => {
    const info = entry?.account?.data?.parsed?.info;
    const mint = info?.mint;
    const amount = String(info?.tokenAmount?.amount ?? "");
    const decimals = Number(info?.tokenAmount?.decimals);
    const number = mintNumbers[mint];
    if (amount !== "1" || decimals !== 0 || !Number.isInteger(number) || seen.has(mint)) return [];
    seen.add(mint);
    return [{ number, mint, tokenAccount: entry.pubkey }];
  }).sort((a, b) => a.number - b.number || a.mint.localeCompare(b.mint));
}

function render(result) {
  lastResult = result;
  resultTitle.textContent = `${result.holdings.length} old Gorigin${result.holdings.length === 1 ? "" : "s"} held directly`;
  resultWallet.textContent = result.wallet;
  resultSlot.textContent = `Finalized slot ${Number(result.slot).toLocaleString()}`;
  holdingsList.replaceChildren();

  if (result.holdings.length === 0) {
    const row = document.createElement("li");
    row.className = "empty";
    row.textContent = "No old Gorigins are held directly by this wallet at this finalized slot.";
    holdingsList.append(row);
  } else {
    for (const holding of result.holdings) {
      const row = document.createElement("li");
      const labels = document.createElement("div");
      const title = document.createElement("strong");
      const match = document.createElement("span");
      const mint = document.createElement("a");
      title.textContent = `Gulag #${holding.number}`;
      match.textContent = `Matches restored Gorigin #${holding.number}`;
      mint.textContent = holding.mint;
      mint.href = `${EXPLORER}${holding.mint}`;
      mint.target = "_blank";
      mint.rel = "noreferrer";
      labels.append(title, match);
      row.append(labels, mint);
      holdingsList.append(row);
    }
  }
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
    const holdings = selectHoldings(tokenResult.value, map.mints);
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
