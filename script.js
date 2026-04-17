const API_URL = "/api/dashboard";
const PAIR = "USD/THB";
const POLL_INTERVAL_MS = 60_000;
const CACHE_KEY = "quoterate-dashboard-cache";
const HISTORY_KEY = "quoterate-usdthb-history";
const FORCE_REFRESH_KEY = "quoterate-force-refresh";
const MAX_HISTORY_POINTS = 24;
const state = {
  dashboard: null,
  fetchedAt: 0,
  history: [],
};

const elements = {
  heroSpreadUsdPrice: document.getElementById("heroSpreadUsdPrice"),
  heroSpreadUsdDetail: document.getElementById("heroSpreadUsdDetail"),
  heroSpreadUsdAdjusted: document.getElementById("heroSpreadUsdAdjusted"),
  heroSpreadUsdBid: document.getElementById("heroSpreadUsdBid"),
  heroSpreadUsdAsk: document.getElementById("heroSpreadUsdAsk"),
  heroUsdtThbPrice: document.getElementById("heroUsdtThbPrice"),
  heroUsdtThbDetail: document.getElementById("heroUsdtThbDetail"),
  heroUsdtThbBid: document.getElementById("heroUsdtThbBid"),
  heroUsdtThbAsk: document.getElementById("heroUsdtThbAsk"),
  heroUsdtThbSpread: document.getElementById("heroUsdtThbSpread"),
  heroUsdtUsdPrice: document.getElementById("heroUsdtUsdPrice"),
  heroUsdtUsdDetail: document.getElementById("heroUsdtUsdDetail"),
  heroUsdtUsdBid: document.getElementById("heroUsdtUsdBid"),
  heroUsdtUsdAsk: document.getElementById("heroUsdtUsdAsk"),
  heroUsdtUsdSpread: document.getElementById("heroUsdtUsdSpread"),
  heroTimestamp: document.getElementById("heroTimestamp"),
  chartLine: document.getElementById("usdThbChartLine"),
  chartArea: document.getElementById("usdThbChartArea"),
  chartEmpty: document.getElementById("chartEmpty"),
  chartCurrent: document.getElementById("chartCurrent"),
  chartHigh: document.getElementById("chartHigh"),
  chartLow: document.getElementById("chartLow"),
  chartLabels: document.getElementById("chartLabels"),
  chartYAxis: document.getElementById("chartYAxis"),
  statusText: document.getElementById("statusText"),
  updatedText: document.getElementById("updatedText"),
  refreshButton: document.getElementById("refreshButton"),
  heroSpreadNumbers: document.querySelectorAll(
    ".hero-spotlight-spread .hero-price, .hero-spotlight-spread .mini-stat strong"
  ),
};

async function fetchQuote() {
  const response = await fetch(API_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

function setStatus(message) {
  elements.statusText.textContent = message;
}

function setRefreshButtonState(label, disabled = false) {
  if (!elements.refreshButton) {
    return;
  }

  elements.refreshButton.textContent = label;
  elements.refreshButton.disabled = disabled;
  elements.refreshButton.setAttribute("aria-disabled", disabled ? "true" : "false");
  elements.refreshButton.classList.toggle("is-busy", disabled);
}

function readCachedDashboard() {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed?.dashboard || !parsed?.fetchedAt) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn("Unable to read cached dashboard", error);
    return null;
  }
}

function writeCachedDashboard(dashboard) {
  const payload = {
    dashboard,
    fetchedAt: Date.now(),
  };

  state.dashboard = dashboard;
  state.fetchedAt = payload.fetchedAt;

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Unable to write dashboard cache", error);
  }
}

function readHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch (error) {
    console.warn("Unable to read USD/THB history", error);
    return [];
  }
}

function writeHistory() {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
  } catch (error) {
    console.warn("Unable to write USD/THB history", error);
  }
}

function isRefreshDue() {
  if (!state.fetchedAt) {
    return true;
  }

  return Date.now() - state.fetchedAt >= POLL_INTERVAL_MS;
}

function consumeForcedRefresh() {
  try {
    const forced = window.localStorage.getItem(FORCE_REFRESH_KEY) === "true";
    if (forced) {
      window.localStorage.removeItem(FORCE_REFRESH_KEY);
    }
    return forced;
  } catch (error) {
    console.warn("Unable to read forced refresh flag", error);
    return false;
  }
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

function getUsdThbQuote() {
  return state.dashboard?.usd_thb ?? null;
}

function getEurUsdQuote() {
  return state.dashboard?.eur_usd ?? null;
}

function getUsdtThbQuote() {
  return state.dashboard?.usdt_thb ?? null;
}

function getUsdtUsdQuote() {
  return state.dashboard?.usdt_usd ?? null;
}

function getDerivedRates() {
  return state.dashboard?.derived ?? null;
}

function getSourceErrors() {
  return state.dashboard?.source_errors ?? {};
}

function getEurUsdMid() {
  const quote = getEurUsdQuote();
  if (!quote) {
    return null;
  }

  return (quote.bid + quote.ask) / 2;
}

function getUsdMid() {
  const quote = getUsdThbQuote();
  if (!quote) {
    return null;
  }

  return (quote.bid + quote.ask) / 2;
}

function updateUsdHistory() {
  const quote = getUsdThbQuote();
  const mid = getUsdMid();

  if (!quote || mid === null) {
    return;
  }

  const lastPoint = state.history.at(-1);
  if (lastPoint?.timestamp === quote.timestamp) {
    return;
  }

  state.history.push({
    timestamp: quote.timestamp,
    value: Number(mid.toFixed(6)),
  });
  state.history = state.history.slice(-MAX_HISTORY_POINTS);
  writeHistory();
}

function getEurDerivedQuote() {
  const usdThb = getUsdThbQuote();
  const eurUsd = getEurUsdQuote();
  const derived = getDerivedRates();

  if (!usdThb || !eurUsd || !derived) {
    return null;
  }

  const bid = eurUsd.bid * usdThb.bid;
  const ask = eurUsd.ask * usdThb.ask;
  const spread = ask - bid;
  const timestamp =
    new Date(eurUsd.timestamp).getTime() > new Date(usdThb.timestamp).getTime()
      ? eurUsd.timestamp
      : usdThb.timestamp;

  return {
    bid,
    ask,
    spread,
    mid: derived.eur_thb_mid,
    timestamp,
  };
}

function animateHeroSpreadCards() {
  elements.heroSpreadNumbers.forEach((element) => {
    element.classList.remove("is-refreshing");
    void element.offsetWidth;
    element.classList.add("is-refreshing");
  });
}

function getMovementDirection() {
  const quote = getUsdThbQuote();
  if (!quote) {
    return "flat";
  }

  const currentMid = getUsdMid();
  const closingMid = (quote.closingBid + quote.closingAsk) / 2;

  if (currentMid > closingMid) {
    return "up";
  }

  if (currentMid < closingMid) {
    return "down";
  }

  return "flat";
}

function resetHeroCards() {
  const placeholders = [
    elements.heroSpreadUsdPrice,
    elements.heroSpreadUsdAdjusted,
    elements.heroSpreadUsdBid,
    elements.heroSpreadUsdAsk,
    elements.heroUsdtThbPrice,
    elements.heroUsdtThbBid,
    elements.heroUsdtThbAsk,
    elements.heroUsdtThbSpread,
    elements.heroUsdtUsdPrice,
    elements.heroUsdtUsdBid,
    elements.heroUsdtUsdAsk,
    elements.heroUsdtUsdSpread,
  ];

  placeholders.forEach((element) => {
    element.textContent = "--.--";
  });

  elements.heroSpreadUsdDetail.textContent = "";
  elements.heroUsdtThbDetail.textContent = "";
  elements.heroUsdtUsdDetail.textContent = "";
  elements.heroTimestamp.textContent = "Waiting for the first quote.";
}

function renderHeroQuote() {
  const usdQuote = getUsdThbQuote();
  const usdtThb = getUsdtThbQuote();
  const usdtUsd = getUsdtUsdQuote();

  if (!usdQuote || !usdtThb || !usdtUsd) {
    resetHeroCards();
    return;
  }

  const usdMid = getUsdMid();
  const usdSpread = usdQuote.ask - usdQuote.bid;
  const usdtThbMid = (usdtThb.bid + usdtThb.ask) / 2;
  const usdtThbSpread = usdtThb.ask - usdtThb.bid;
  const usdtUsdMid = (usdtUsd.bid + usdtUsd.ask) / 2;
  const usdtUsdSpread = usdtUsd.ask - usdtUsd.bid;
  const usdtUsdInThb = usdtUsdMid * usdtThbMid;

  elements.heroSpreadUsdPrice.textContent = formatNumber(usdMid, 3);
  elements.heroSpreadUsdDetail.textContent = "";
  elements.heroSpreadUsdAdjusted.textContent = formatNumber(usdSpread, 3);
  elements.heroSpreadUsdBid.textContent = formatNumber(usdQuote.bid, 3);
  elements.heroSpreadUsdAsk.textContent = formatNumber(usdQuote.ask, 3);

  elements.heroUsdtThbPrice.textContent = formatNumber(usdtThbMid, 3);
  elements.heroUsdtThbDetail.textContent = "";
  elements.heroUsdtThbBid.textContent = formatNumber(usdtThb.bid, 3);
  elements.heroUsdtThbAsk.textContent = formatNumber(usdtThb.ask, 3);
  elements.heroUsdtThbSpread.textContent = formatNumber(usdtThbSpread, 3);

  elements.heroUsdtUsdPrice.textContent = formatNumber(usdtUsdMid, 5);
  elements.heroUsdtUsdDetail.textContent = `THB rate ${formatNumber(usdtUsdInThb, 3)}.`;
  elements.heroUsdtUsdBid.textContent = formatNumber(usdtUsd.bid, 5);
  elements.heroUsdtUsdAsk.textContent = formatNumber(usdtUsd.ask, 5);
  elements.heroUsdtUsdSpread.textContent = formatNumber(usdtUsdSpread, 5);

  animateHeroSpreadCards();
}

function renderChart() {
  const points = state.history;

  if (!points.length) {
    elements.chartLine.setAttribute("d", "");
    elements.chartArea.setAttribute("d", "");
    elements.chartEmpty.hidden = false;
    elements.chartCurrent.textContent = "--.--";
    elements.chartHigh.textContent = "--.--";
    elements.chartLow.textContent = "--.--";
    elements.chartLabels.innerHTML = "";
    if (elements.chartYAxis) {
      elements.chartYAxis.innerHTML = "<span>--.--</span><span>--.--</span><span>--.--</span>";
    }
    return;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 0.01;
  const width = 640;
  const height = 220;
  const stepX = points.length > 1 ? width / (points.length - 1) : width / 2;

  const coordinates = points.map((point, index) => {
    const x = points.length > 1 ? index * stepX : width / 2;
    const normalized = (point.value - min) / range;
    const y = height - normalized * (height - 24) - 12;
    return { x, y };
  });

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L ${coordinates.at(-1).x.toFixed(2)} ${height} L ${coordinates[0].x.toFixed(2)} ${height} Z`;

  elements.chartLine.setAttribute("d", linePath);
  elements.chartArea.setAttribute("d", areaPath);
  elements.chartEmpty.hidden = points.length > 1;
  elements.chartCurrent.textContent = formatNumber(points.at(-1).value, 3);
  elements.chartHigh.textContent = formatNumber(max, 3);
  elements.chartLow.textContent = formatNumber(min, 3);
  if (elements.chartYAxis) {
    const midpoint = min + (max - min) / 2;
    elements.chartYAxis.innerHTML = `
      <span>${formatNumber(max, 3)}</span>
      <span>${formatNumber(midpoint, 3)}</span>
      <span>${formatNumber(min, 3)}</span>
    `;
  }

  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  elements.chartLabels.innerHTML = labelIndexes
    .map((index) => `<span>${formatDateTime(points[index].timestamp)}</span>`)
    .join("");
}

function renderUpdatedAt() {
  const timestamps = [
    getUsdThbQuote()?.timestamp,
    getEurUsdQuote()?.timestamp,
    getUsdtThbQuote()?.timestamp,
    getUsdtUsdQuote()?.timestamp,
  ].filter(Boolean);

  if (timestamps.length) {
    const latestTimestamp = formatDateTime(timestamps.sort().at(-1));
    elements.updatedText.textContent = latestTimestamp;
    elements.heroTimestamp.textContent = `Quote timestamp ${latestTimestamp}.`;
    return;
  }

  elements.updatedText.textContent = "Waiting for data";
  elements.heroTimestamp.textContent = "Waiting for the first quote.";
}

function renderAll() {
  updateUsdHistory();
  renderHeroQuote();
  renderUpdatedAt();
  renderChart();
}

async function loadQuote() {
  setStatus("Refreshing quote...");
  const data = await fetchQuote();

  writeCachedDashboard(data);
  renderAll();
  const errorCount = Object.values(getSourceErrors()).filter(Boolean).length;
  setStatus(errorCount ? "Live quote loaded with partial fallback" : "Live quote loaded");
}

async function refreshIfDue() {
  const forcedRefresh = consumeForcedRefresh();

  if (!forcedRefresh && !isRefreshDue()) {
    setStatus("Using recent quote");
    return;
  }

  await loadQuote();
}

function bindEvents() {
  elements.refreshButton.addEventListener("click", async () => {
    if (elements.refreshButton.classList.contains("is-busy")) {
      return;
    }

    setRefreshButtonState("Refreshing...", true);

    try {
      await loadQuote();
      setRefreshButtonState("Updated");
    } catch (error) {
      handleError(error);
      setRefreshButtonState("Try Again");
    }

    window.setTimeout(() => {
      setRefreshButtonState("Refresh Now");
    }, 1200);
  });
}

function handleError(error) {
  console.error(error);
  setRefreshButtonState("Refresh Now");
  setStatus("Unable to load quote");
  elements.updatedText.textContent = "Check connection";
  resetHeroCards();
}

async function init() {
  try {
    bindEvents();
    const cached = readCachedDashboard();

    if (cached) {
      state.dashboard = cached.dashboard;
      state.fetchedAt = cached.fetchedAt;
      state.history = readHistory();
      renderAll();
      setStatus(isRefreshDue() ? "Quote due for refresh" : "Using recent quote");
    }

    if (!cached) {
      state.history = readHistory();
      renderChart();
    }

    await refreshIfDue();

    window.setInterval(() => {
      refreshIfDue().catch(handleError);
    }, POLL_INTERVAL_MS);
  } catch (error) {
    handleError(error);
  }
}

init();
