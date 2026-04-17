(() => {
const ARBITAGE_API_URL = "/api/dashboard";
const ARBITAGE_CACHE_KEY = "quoterate-dashboard-cache";
const ARBITAGE_POLL_INTERVAL_MS = 60_000;
const COINBASE_FEE = 0.002;
const BITKUB_FEE = 0.0016;
const OANDA_MARGIN = 0.0008;

const elements = {
  timestamp: document.getElementById("arbitageTimestamp"),
  referenceUsdPrice: document.getElementById("referenceUsdPrice"),
  referenceUsdDetail: document.getElementById("referenceUsdDetail"),
  referenceUsdBid: document.getElementById("referenceUsdBid"),
  referenceUsdAsk: document.getElementById("referenceUsdAsk"),
  referenceUsdSpread: document.getElementById("referenceUsdSpread"),
  referenceUsdtThbPrice: document.getElementById("referenceUsdtThbPrice"),
  referenceUsdtThbDetail: document.getElementById("referenceUsdtThbDetail"),
  referenceUsdtThbBid: document.getElementById("referenceUsdtThbBid"),
  referenceUsdtThbAsk: document.getElementById("referenceUsdtThbAsk"),
  referenceUsdtThbSpread: document.getElementById("referenceUsdtThbSpread"),
  referenceUsdtUsdPrice: document.getElementById("referenceUsdtUsdPrice"),
  referenceUsdtUsdDetail: document.getElementById("referenceUsdtUsdDetail"),
  referenceUsdtUsdBid: document.getElementById("referenceUsdtUsdBid"),
  referenceUsdtUsdAsk: document.getElementById("referenceUsdtUsdAsk"),
  referenceUsdtUsdSpread: document.getElementById("referenceUsdtUsdSpread"),
  usdAmountInput: document.getElementById("usdAmountInput"),
  thbAmountInput: document.getElementById("thbAmountInput"),
  usdVerdictBadge: document.getElementById("usdVerdictBadge"),
  usdDirectOutput: document.getElementById("usdDirectOutput"),
  usdSyntheticOutput: document.getElementById("usdSyntheticOutput"),
  usdFlowStart: document.getElementById("usdFlowStart"),
  usdFlowCoinbase: document.getElementById("usdFlowCoinbase"),
  usdFlowCoinbaseMeta: document.getElementById("usdFlowCoinbaseMeta"),
  usdFlowBitkub: document.getElementById("usdFlowBitkub"),
  usdFlowBitkubMeta: document.getElementById("usdFlowBitkubMeta"),
  usdFlowReturn: document.getElementById("usdFlowReturn"),
  usdFlowReturnMeta: document.getElementById("usdFlowReturnMeta"),
  usdFlowDirect: document.getElementById("usdFlowDirect"),
  usdFlowDirectMeta: document.getElementById("usdFlowDirectMeta"),
  usdFlowEdge: document.getElementById("usdFlowEdge"),
  usdFlowEdgeMeta: document.getElementById("usdFlowEdgeMeta"),
  thbVerdictBadge: document.getElementById("thbVerdictBadge"),
  thbDirectOutput: document.getElementById("thbDirectOutput"),
  thbSyntheticOutput: document.getElementById("thbSyntheticOutput"),
  thbFlowStart: document.getElementById("thbFlowStart"),
  thbFlowBitkub: document.getElementById("thbFlowBitkub"),
  thbFlowBitkubMeta: document.getElementById("thbFlowBitkubMeta"),
  thbFlowCoinbase: document.getElementById("thbFlowCoinbase"),
  thbFlowCoinbaseMeta: document.getElementById("thbFlowCoinbaseMeta"),
  thbFlowReturn: document.getElementById("thbFlowReturn"),
  thbFlowReturnMeta: document.getElementById("thbFlowReturnMeta"),
  thbFlowDirect: document.getElementById("thbFlowDirect"),
  thbFlowDirectMeta: document.getElementById("thbFlowDirectMeta"),
  thbFlowEdge: document.getElementById("thbFlowEdge"),
  thbFlowEdgeMeta: document.getElementById("thbFlowEdgeMeta"),
};

const state = {
  dashboard: null,
};

function readCachedDashboard() {
  try {
    const raw = window.localStorage.getItem(ARBITAGE_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed?.dashboard ?? null;
  } catch (error) {
    console.warn("Unable to read dashboard cache", error);
    return null;
  }
}

function writeCachedDashboard(dashboard) {
  try {
    window.localStorage.setItem(
      ARBITAGE_CACHE_KEY,
      JSON.stringify({
        dashboard,
        fetchedAt: Date.now(),
      }),
    );
  } catch (error) {
    console.warn("Unable to write dashboard cache", error);
  }
}

async function fetchDashboard() {
  const response = await fetch(ARBITAGE_API_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

async function refreshDashboard() {
  const dashboard = await fetchDashboard();
  writeCachedDashboard(dashboard);
  renderDashboard(dashboard);
  return dashboard;
}

function formatNumber(value, maximumFractionDigits = 4) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function formatDateTime(value) {
  if (!value) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function setWaitingState() {
  elements.timestamp.textContent = "Waiting for the latest quote.";

  [
    elements.referenceUsdPrice,
    elements.referenceUsdBid,
    elements.referenceUsdAsk,
    elements.referenceUsdSpread,
    elements.referenceUsdtThbPrice,
    elements.referenceUsdtThbBid,
    elements.referenceUsdtThbAsk,
    elements.referenceUsdtThbSpread,
    elements.referenceUsdtUsdPrice,
    elements.referenceUsdtUsdBid,
    elements.referenceUsdtUsdAsk,
    elements.referenceUsdtUsdSpread,
    elements.usdDirectOutput,
    elements.usdSyntheticOutput,
    elements.usdFlowStart,
    elements.usdFlowCoinbase,
    elements.usdFlowBitkub,
    elements.usdFlowReturn,
    elements.usdFlowDirect,
    elements.usdFlowEdge,
    elements.thbDirectOutput,
    elements.thbSyntheticOutput,
    elements.thbFlowStart,
    elements.thbFlowBitkub,
    elements.thbFlowCoinbase,
    elements.thbFlowReturn,
    elements.thbFlowDirect,
    elements.thbFlowEdge,
  ].forEach((element) => {
    element.textContent = "--.--";
  });

  elements.referenceUsdDetail.textContent = "Waiting for the latest quote.";
  elements.referenceUsdtThbDetail.textContent = "Waiting for the latest quote.";
  elements.referenceUsdtUsdDetail.textContent = "Waiting for the latest quote.";

  setVerdict(elements.usdVerdictBadge, "Waiting for quote", "neutral");
  setVerdict(elements.thbVerdictBadge, "Waiting for quote", "neutral");
  elements.usdFlowCoinbaseMeta.textContent = "Ask --.-- less 0.20%";
  elements.usdFlowBitkubMeta.textContent = "Bid --.-- less 0.16%";
  elements.usdFlowReturnMeta.textContent = "Ask --.-- plus 0.08%";
  elements.usdFlowDirectMeta.textContent = "Back in USD after the OANDA return leg.";
  elements.usdFlowEdgeMeta.textContent = "Waiting for quote.";
  elements.thbFlowBitkubMeta.textContent = "Ask --.-- less 0.16%";
  elements.thbFlowCoinbaseMeta.textContent = "Bid --.-- less 0.20%";
  elements.thbFlowReturnMeta.textContent = "Bid --.-- less 0.08%";
  elements.thbFlowDirectMeta.textContent = "Back in THB after the OANDA return leg.";
  elements.thbFlowEdgeMeta.textContent = "Waiting for quote.";
}

function setVerdict(element, label, tone) {
  element.textContent = label;
  element.className = `arbitage-badge arbitage-badge-${tone}`;
}

function renderReferenceSnapshot(dashboard) {
  const usdThb = dashboard?.usd_thb;
  const usdtThb = dashboard?.usdt_thb;
  const usdtUsd = dashboard?.usdt_usd;

  if (!usdThb || !usdtThb || !usdtUsd) {
    elements.referenceUsdDetail.textContent = "Waiting for the latest quote.";
    elements.referenceUsdtThbDetail.textContent = "Waiting for the latest quote.";
    elements.referenceUsdtUsdDetail.textContent = "Waiting for the latest quote.";
    return;
  }

  const usdMid = (usdThb.bid + usdThb.ask) / 2;
  const usdSpread = usdThb.ask - usdThb.bid;
  const usdtThbMid = (usdtThb.bid + usdtThb.ask) / 2;
  const usdtThbSpread = usdtThb.ask - usdtThb.bid;
  const usdtUsdMid = (usdtUsd.bid + usdtUsd.ask) / 2;
  const usdtUsdSpread = usdtUsd.ask - usdtUsd.bid;
  const usdtUsdInThb = usdtUsdMid * usdtThbMid;

  elements.referenceUsdPrice.textContent = formatNumber(usdMid, 3);
  elements.referenceUsdDetail.textContent = "Direct USD/THB midpoint from the Home page.";
  elements.referenceUsdBid.textContent = formatNumber(usdThb.bid, 3);
  elements.referenceUsdAsk.textContent = formatNumber(usdThb.ask, 3);
  elements.referenceUsdSpread.textContent = formatNumber(usdSpread, 3);

  elements.referenceUsdtThbPrice.textContent = formatNumber(usdtThbMid, 3);
  elements.referenceUsdtThbDetail.textContent = "Top-of-book USDT/THB from the Home page.";
  elements.referenceUsdtThbBid.textContent = formatNumber(usdtThb.bid, 3);
  elements.referenceUsdtThbAsk.textContent = formatNumber(usdtThb.ask, 3);
  elements.referenceUsdtThbSpread.textContent = formatNumber(usdtThbSpread, 3);

  elements.referenceUsdtUsdPrice.textContent = formatNumber(usdtUsdMid, 5);
  elements.referenceUsdtUsdDetail.textContent = `THB rate ${formatNumber(usdtUsdInThb, 3)}.`;
  elements.referenceUsdtUsdBid.textContent = formatNumber(usdtUsd.bid, 5);
  elements.referenceUsdtUsdAsk.textContent = formatNumber(usdtUsd.ask, 5);
  elements.referenceUsdtUsdSpread.textContent = formatNumber(usdtUsdSpread, 5);
}

function getLatestTimestamp(dashboard) {
  const timestamps = [
    dashboard?.usd_thb?.timestamp,
    dashboard?.usdt_thb?.timestamp,
    dashboard?.usdt_usd?.timestamp,
  ].filter(Boolean);

  return timestamps.sort().at(-1) ?? null;
}

function calculateUsdToThb(usdAmount, dashboard) {
  const usdThb = dashboard?.usd_thb;
  const usdtThb = dashboard?.usdt_thb;
  const usdtUsd = dashboard?.usdt_usd;

  if (!usdThb || !usdtThb || !usdtUsd || usdAmount <= 0) {
    return null;
  }

  const usdtBought = (usdAmount / usdtUsd.ask) * (1 - COINBASE_FEE);
  const thbReceived = usdtBought * usdtThb.bid * (1 - BITKUB_FEE);
  const oandaReturnAsk = usdThb.ask * (1 + OANDA_MARGIN);
  const usdReturned = thbReceived / oandaReturnAsk;
  const edge = usdReturned - usdAmount;

  return {
    directOutput: usdAmount,
    syntheticOutput: usdReturned,
    directRate: 1 / oandaReturnAsk,
    syntheticRate: usdReturned / usdAmount,
    edge,
    edgePercent: usdAmount ? (edge / usdAmount) * 100 : 0,
    coinbaseAsk: usdtUsd.ask,
    bitkubBid: usdtThb.bid,
    usdtBought,
    thbReceived,
    oandaReturnAsk,
  };
}

function calculateThbToUsd(thbAmount, dashboard) {
  const usdThb = dashboard?.usd_thb;
  const usdtThb = dashboard?.usdt_thb;
  const usdtUsd = dashboard?.usdt_usd;

  if (!usdThb || !usdtThb || !usdtUsd || thbAmount <= 0) {
    return null;
  }

  const usdtBought = (thbAmount / usdtThb.ask) * (1 - BITKUB_FEE);
  const usdReceived = usdtBought * usdtUsd.bid * (1 - COINBASE_FEE);
  const oandaReturnBid = usdThb.bid * (1 - OANDA_MARGIN);
  const thbReturned = usdReceived * oandaReturnBid;
  const edge = thbReturned - thbAmount;

  return {
    directOutput: thbAmount,
    syntheticOutput: thbReturned,
    directRate: oandaReturnBid,
    syntheticRate: thbReturned / thbAmount,
    edge,
    edgePercent: thbAmount ? (edge / thbAmount) * 100 : 0,
    bitkubAsk: usdtThb.ask,
    coinbaseBid: usdtUsd.bid,
    usdtBought,
    usdReceived,
    oandaReturnBid,
  };
}

function renderUsdToThb(dashboard) {
  const usdAmount = Number(elements.usdAmountInput.value || 0);
  const result = calculateUsdToThb(usdAmount, dashboard);

  if (!result) {
    setVerdict(elements.usdVerdictBadge, "Waiting for quote", "neutral");
    elements.usdDirectOutput.textContent = "--.-- USD";
    elements.usdSyntheticOutput.textContent = "--.-- USD";
    elements.usdFlowCoinbaseMeta.textContent = "Need USD/THB, USDT/THB, and USDT/USD quotes.";
    elements.usdFlowBitkubMeta.textContent = "Refresh the dashboard to load the latest route.";
    elements.usdFlowReturnMeta.textContent = "OANDA return leg will appear here.";
    elements.usdFlowDirectMeta.textContent = "Back in USD after the OANDA return leg.";
    elements.usdFlowEdgeMeta.textContent = "The fee-adjusted USD edge will appear here.";
    return;
  }

  const tone = result.edge > 0 ? "positive" : result.edge < 0 ? "negative" : "neutral";
  const verdict =
    result.edge > 0
      ? `Worth it by ${formatNumber(result.edge, 2)} USD`
      : result.edge < 0
        ? `Not worth it by ${formatNumber(Math.abs(result.edge), 2)} USD`
        : "Flat edge";

  setVerdict(elements.usdVerdictBadge, verdict, tone);
  elements.usdDirectOutput.textContent = `${formatNumber(result.directOutput, 2)} USD`;
  elements.usdSyntheticOutput.textContent = `${formatNumber(result.syntheticOutput, 2)} USD`;
  elements.usdFlowStart.textContent = `${formatNumber(usdAmount, 2)} USD`;
  elements.usdFlowCoinbase.textContent = `${formatNumber(result.usdtBought, 6)} USDT`;
  elements.usdFlowCoinbaseMeta.textContent = `Ask ${formatNumber(result.coinbaseAsk, 5)} less 0.20%`;
  elements.usdFlowBitkub.textContent = `${formatNumber(result.thbReceived, 2)} THB`;
  elements.usdFlowBitkubMeta.textContent = `Bid ${formatNumber(result.bitkubBid, 3)} less 0.16%`;
  elements.usdFlowReturn.textContent = `${formatNumber(result.syntheticOutput, 2)} USD`;
  elements.usdFlowReturnMeta.textContent = `Ask ${formatNumber(result.oandaReturnAsk, 3)} plus 0.08%`;
  elements.usdFlowDirect.textContent = `${formatNumber(result.syntheticOutput, 2)} USD`;
  elements.usdFlowDirectMeta.textContent = `Round trip finished back in USD after the OANDA return leg.`;
  elements.usdFlowEdge.textContent = `${result.edge >= 0 ? "+" : "-"}${formatNumber(Math.abs(result.edge), 2)} USD`;
  elements.usdFlowEdgeMeta.textContent = `Start ${formatNumber(result.directOutput, 2)} USD, finish ${formatNumber(result.syntheticOutput, 2)} USD after all three legs.`;
}

function renderThbToUsd(dashboard) {
  const thbAmount = Number(elements.thbAmountInput.value || 0);
  const result = calculateThbToUsd(thbAmount, dashboard);

  if (!result) {
    setVerdict(elements.thbVerdictBadge, "Waiting for quote", "neutral");
    elements.thbDirectOutput.textContent = "--.-- THB";
    elements.thbSyntheticOutput.textContent = "--.-- THB";
    elements.thbFlowBitkubMeta.textContent = "Need USD/THB, USDT/THB, and USDT/USD quotes.";
    elements.thbFlowCoinbaseMeta.textContent = "Refresh the dashboard to load the latest route.";
    elements.thbFlowReturnMeta.textContent = "OANDA return leg will appear here.";
    elements.thbFlowDirectMeta.textContent = "Back in THB after the OANDA return leg.";
    elements.thbFlowEdgeMeta.textContent = "The fee-adjusted THB edge will appear here.";
    return;
  }

  const tone = result.edge > 0 ? "positive" : result.edge < 0 ? "negative" : "neutral";
  const verdict =
    result.edge > 0
      ? `Worth it by ${formatNumber(result.edge, 2)} THB`
      : result.edge < 0
        ? `Not worth it by ${formatNumber(Math.abs(result.edge), 2)} THB`
        : "Flat edge";

  setVerdict(elements.thbVerdictBadge, verdict, tone);
  elements.thbDirectOutput.textContent = `${formatNumber(result.directOutput, 2)} THB`;
  elements.thbSyntheticOutput.textContent = `${formatNumber(result.syntheticOutput, 2)} THB`;
  elements.thbFlowStart.textContent = `${formatNumber(thbAmount, 2)} THB`;
  elements.thbFlowBitkub.textContent = `${formatNumber(result.usdtBought, 6)} USDT`;
  elements.thbFlowBitkubMeta.textContent = `Ask ${formatNumber(result.bitkubAsk, 3)} less 0.16%`;
  elements.thbFlowCoinbase.textContent = `${formatNumber(result.usdReceived, 2)} USD`;
  elements.thbFlowCoinbaseMeta.textContent = `Bid ${formatNumber(result.coinbaseBid, 5)} less 0.20%`;
  elements.thbFlowReturn.textContent = `${formatNumber(result.syntheticOutput, 2)} THB`;
  elements.thbFlowReturnMeta.textContent = `Bid ${formatNumber(result.oandaReturnBid, 3)} less 0.08%`;
  elements.thbFlowDirect.textContent = `${formatNumber(result.syntheticOutput, 2)} THB`;
  elements.thbFlowDirectMeta.textContent = `Round trip finished back in THB after the OANDA return leg.`;
  elements.thbFlowEdge.textContent = `${result.edge >= 0 ? "+" : "-"}${formatNumber(Math.abs(result.edge), 2)} THB`;
  elements.thbFlowEdgeMeta.textContent = `Start ${formatNumber(result.directOutput, 2)} THB, finish ${formatNumber(result.syntheticOutput, 2)} THB after all three legs.`;
}

function renderDashboard(dashboard) {
  if (!dashboard) {
    setWaitingState();
    return;
  }

  state.dashboard = dashboard;
  const latestTimestamp = getLatestTimestamp(dashboard);
  elements.timestamp.textContent = latestTimestamp
    ? `Quote timestamp ${formatDateTime(latestTimestamp)}.`
    : "Waiting for the latest quote.";

  renderReferenceSnapshot(dashboard);
  renderUsdToThb(dashboard);
  renderThbToUsd(dashboard);
}

function bindEvents() {
  elements.usdAmountInput.addEventListener("input", () => renderDashboard(state.dashboard));
  elements.thbAmountInput.addEventListener("input", () => renderDashboard(state.dashboard));

  window.addEventListener("dashboard-refreshed", (event) => {
    renderDashboard(event.detail?.dashboard ?? readCachedDashboard());
  });
}

async function init() {
  bindEvents();
  const cached = readCachedDashboard();
  renderDashboard(cached);

  try {
    await refreshDashboard();
  } catch (error) {
    console.warn("Unable to fetch dashboard for Arbitage", error);
  }

  window.setInterval(() => {
    refreshDashboard().catch((error) => {
      console.warn("Unable to auto-refresh Arbitage dashboard", error);
    });
  }, ARBITAGE_POLL_INTERVAL_MS);
}

init().catch((error) => {
  console.warn("Unable to initialize Arbitage page", error);
});
})();
