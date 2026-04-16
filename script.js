const API_URL = "/api/dashboard";
const PAIR = "USD/THB";
const POLL_INTERVAL_MS = 30_000;

const state = {
  amount: 100,
  from: "USD",
  to: "THB",
  dashboard: null,
  lastCheckedAt: null,
};

const elements = {
  amountInput: document.getElementById("amountInput"),
  fromCurrency: document.getElementById("fromCurrency"),
  toCurrency: document.getElementById("toCurrency"),
  heroPrice: document.getElementById("heroPrice"),
  heroDetail: document.getElementById("heroDetail"),
  heroBid: document.getElementById("heroBid"),
  heroAsk: document.getElementById("heroAsk"),
  heroSpread: document.getElementById("heroSpread"),
  heroEurThb: document.getElementById("heroEurThb"),
  marketPulse: document.getElementById("marketPulse"),
  rateCards: document.getElementById("rateCards"),
  metricsTableBody: document.getElementById("metricsTableBody"),
  conversionResult: document.getElementById("conversionResult"),
  conversionDetail: document.getElementById("conversionDetail"),
  statusText: document.getElementById("statusText"),
  updatedText: document.getElementById("updatedText"),
  refreshButton: document.getElementById("refreshButton"),
  swapButton: document.getElementById("swapButton"),
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

function formatNumber(value, maximumFractionDigits = 4) {
  return new Intl.NumberFormat(undefined, {
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

function getDerivedRates() {
  return state.dashboard?.derived ?? null;
}

function getMidPrice() {
  const quote = getUsdThbQuote();
  if (!quote) {
    return null;
  }

  return (quote.bid + quote.ask) / 2;
}

function getMovementDirection() {
  const quote = getUsdThbQuote();
  if (!quote) {
    return "flat";
  }

  const currentMid = getMidPrice();
  const closingMid = (quote.closingBid + quote.closingAsk) / 2;

  if (currentMid > closingMid) {
    return "up";
  }

  if (currentMid < closingMid) {
    return "down";
  }

  return "flat";
}

function renderHeroQuote() {
  const quote = getUsdThbQuote();
  const derived = getDerivedRates();

  if (!quote || !derived) {
    elements.heroPrice.textContent = "--.--";
    elements.heroDetail.textContent = "Waiting for the first quote.";
    elements.heroBid.textContent = "--.--";
    elements.heroAsk.textContent = "--.--";
    elements.heroSpread.textContent = "--.--";
    elements.heroEurThb.textContent = "--.--";
    elements.marketPulse.textContent = "Waiting";
    elements.marketPulse.className = "pulse-chip";
    return;
  }

  const mid = getMidPrice();
  const spread = quote.ask - quote.bid;
  const direction = getMovementDirection();
  const movementLabels = {
    up: "Trading above close",
    down: "Trading below close",
    flat: "Near prior close",
  };

  elements.heroPrice.textContent = formatNumber(mid, 3);
  elements.heroDetail.textContent = `Last server check ${formatDateTime(state.lastCheckedAt)}. Quote timestamp ${formatDateTime(quote.timestamp)}.`;
  elements.heroBid.textContent = formatNumber(quote.bid, 3);
  elements.heroAsk.textContent = formatNumber(quote.ask, 3);
  elements.heroSpread.textContent = formatNumber(spread, 3);
  elements.heroEurThb.textContent = formatNumber(derived.eur_thb_mid, 3);
  elements.marketPulse.textContent = movementLabels[direction];
  elements.marketPulse.className = `pulse-chip${direction === "flat" ? "" : ` is-${direction}`}`;
}

function renderConversion() {
  const amount = Number(elements.amountInput.value || 0);
  state.amount = amount;
  state.from = elements.fromCurrency.value;
  state.to = elements.toCurrency.value;

  const mid = getMidPrice();
  if (!mid) {
    elements.conversionResult.textContent = "Loading...";
    elements.conversionDetail.textContent = "Waiting for the latest USD/THB quote.";
    return;
  }

  const rate = state.from === "USD" ? mid : 1 / mid;
  const converted = amount * rate;

  elements.conversionResult.textContent = `${formatNumber(converted, 2)} ${state.to}`;
  elements.conversionDetail.textContent = `Using midpoint ${formatNumber(mid, 5)} THB per USD`;
}

function renderCards() {
  const quote = getUsdThbQuote();
  const derived = getDerivedRates();

  if (!quote || !derived) {
    elements.rateCards.innerHTML = '<p class="empty-state">Waiting for the first live quote.</p>';
    return;
  }

  const spread = quote.ask - quote.bid;
  const mid = getMidPrice();
  const closingMid = (quote.closingBid + quote.closingAsk) / 2;
  const delta = mid - closingMid;

  elements.rateCards.innerHTML = `
    <article class="rate-card">
      <span class="rate-pair">${PAIR} Bid</span>
      <strong class="rate-value">${formatNumber(quote.bid, 3)}</strong>
      <span class="rate-subvalue">Live buy-side quote</span>
    </article>
    <article class="rate-card">
      <span class="rate-pair">${PAIR} Ask</span>
      <strong class="rate-value">${formatNumber(quote.ask, 3)}</strong>
      <span class="rate-subvalue">Live sell-side quote</span>
    </article>
    <article class="rate-card">
      <span class="rate-pair">Mid Price</span>
      <strong class="rate-value">${formatNumber(mid, 3)}</strong>
      <span class="rate-subvalue">${delta >= 0 ? "+" : ""}${formatNumber(delta, 3)} versus close</span>
    </article>
    <article class="rate-card">
      <span class="rate-pair">EUR/THB</span>
      <strong class="rate-value">${formatNumber(derived.eur_thb_mid, 3)}</strong>
      <span class="rate-subvalue">Derived from EUR/USD and USD/THB</span>
    </article>
    <article class="rate-card">
      <span class="rate-pair">USD/THB + 1% fee</span>
      <strong class="rate-value">${formatNumber(derived.usd_thb_fee_1pct, 3)}</strong>
      <span class="rate-subvalue">Typical service markup scenario</span>
    </article>
    <article class="rate-card">
      <span class="rate-pair">USD/THB + 3% fee</span>
      <strong class="rate-value">${formatNumber(derived.usd_thb_fee_3pct, 3)}</strong>
      <span class="rate-subvalue">Heavier card or kiosk markup</span>
    </article>
  `;
}

function renderMetrics() {
  const quote = getUsdThbQuote();
  const derived = getDerivedRates();

  if (!quote || !derived) {
    elements.metricsTableBody.innerHTML = `
      <tr>
        <td colspan="2" class="empty-state">Waiting for the first live quote.</td>
      </tr>
    `;
    return;
  }

  const rows = [
    ["Pair", PAIR],
    ["Timestamp", formatDateTime(quote.timestamp)],
    ["Opening Bid", formatNumber(quote.openingBid, 3)],
    ["Opening Ask", formatNumber(quote.openingAsk, 3)],
    ["Closing Bid", formatNumber(quote.closingBid, 3)],
    ["Closing Ask", formatNumber(quote.closingAsk, 3)],
    ["Session High", formatNumber(quote.high, 3)],
    ["Session Low", formatNumber(quote.low, 3)],
    ["EUR/USD Mid", formatNumber((state.dashboard.eur_usd.bid + state.dashboard.eur_usd.ask) / 2, 5)],
    ["EUR/THB Mid", formatNumber(derived.eur_thb_mid, 3)],
    ["Checked At", formatDateTime(state.lastCheckedAt)],
  ];

  elements.metricsTableBody.innerHTML = rows
    .map(
      ([label, value]) => `
        <tr>
          <td>${label}</td>
          <td>${value}</td>
        </tr>
      `
    )
    .join("");
}

function renderUpdatedAt() {
  const quote = getUsdThbQuote();
  elements.updatedText.textContent = quote ? formatDateTime(quote.timestamp) : "Waiting for data";
}

function renderAll() {
  renderHeroQuote();
  renderUpdatedAt();
  renderCards();
  renderMetrics();
  renderConversion();
}

async function loadQuote() {
  setStatus("Refreshing quote...");
  const data = await fetchQuote();

  state.dashboard = data;
  state.lastCheckedAt = new Date().toISOString();

  renderAll();
  setStatus("Live quote loaded");
}

function swapCurrencies() {
  const previousFrom = elements.fromCurrency.value;
  elements.fromCurrency.value = elements.toCurrency.value;
  elements.toCurrency.value = previousFrom;
  renderConversion();
}

function bindEvents() {
  elements.amountInput.addEventListener("input", renderConversion);
  elements.fromCurrency.addEventListener("change", renderConversion);
  elements.toCurrency.addEventListener("change", renderConversion);
  elements.swapButton.addEventListener("click", swapCurrencies);
  elements.refreshButton.addEventListener("click", () => {
    loadQuote().catch(handleError);
  });
}

function handleError(error) {
  console.error(error);
  setStatus("Unable to load quote");
  elements.updatedText.textContent = "Check connection";
  renderHeroQuote();
  elements.conversionResult.textContent = "Error";
  elements.conversionDetail.textContent = "The OANDA proxy could not be reached.";
  elements.rateCards.innerHTML = '<p class="empty-state">Could not load the live quote.</p>';
  elements.metricsTableBody.innerHTML = `
    <tr>
      <td colspan="2" class="empty-state">Unable to load the live quote right now.</td>
    </tr>
  `;
}

async function init() {
  try {
    bindEvents();
    await loadQuote();

    window.setInterval(() => {
      loadQuote().catch(handleError);
    }, POLL_INTERVAL_MS);
  } catch (error) {
    handleError(error);
  }
}

init();
