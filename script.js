const API_URL = "/api/usd-thb";
const PAIR = "USD/THB";
const POLL_INTERVAL_MS = 30_000;

const state = {
  amount: 100,
  from: "USD",
  to: "THB",
  quote: null,
  lastCheckedAt: null,
};

const elements = {
  amountInput: document.getElementById("amountInput"),
  fromCurrency: document.getElementById("fromCurrency"),
  toCurrency: document.getElementById("toCurrency"),
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

function getMidPrice() {
  if (!state.quote) {
    return null;
  }

  return (state.quote.bid + state.quote.ask) / 2;
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
  if (!state.quote) {
    elements.rateCards.innerHTML = '<p class="empty-state">Waiting for the first live quote.</p>';
    return;
  }

  const spread = state.quote.ask - state.quote.bid;
  const mid = getMidPrice();

  elements.rateCards.innerHTML = `
    <article class="rate-card">
      <span class="rate-pair">${PAIR} Bid</span>
      <strong class="rate-value">${formatNumber(state.quote.bid, 3)}</strong>
    </article>
    <article class="rate-card">
      <span class="rate-pair">${PAIR} Ask</span>
      <strong class="rate-value">${formatNumber(state.quote.ask, 3)}</strong>
    </article>
    <article class="rate-card">
      <span class="rate-pair">Mid Price</span>
      <strong class="rate-value">${formatNumber(mid, 3)}</strong>
    </article>
    <article class="rate-card">
      <span class="rate-pair">Spread</span>
      <strong class="rate-value">${formatNumber(spread, 3)}</strong>
    </article>
  `;
}

function renderMetrics() {
  if (!state.quote) {
    elements.metricsTableBody.innerHTML = `
      <tr>
        <td colspan="2" class="empty-state">Waiting for the first live quote.</td>
      </tr>
    `;
    return;
  }

  const rows = [
    ["Pair", PAIR],
    ["Timestamp", formatDateTime(state.quote.timestamp)],
    ["Opening Bid", formatNumber(state.quote.openingBid, 3)],
    ["Opening Ask", formatNumber(state.quote.openingAsk, 3)],
    ["Closing Bid", formatNumber(state.quote.closingBid, 3)],
    ["Closing Ask", formatNumber(state.quote.closingAsk, 3)],
    ["Session High", formatNumber(state.quote.high, 3)],
    ["Session Low", formatNumber(state.quote.low, 3)],
    ["Pip Location", String(state.quote.pipLocation)],
    ["Extra Precision", String(state.quote.extraPrecision)],
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
  elements.updatedText.textContent = state.quote
    ? formatDateTime(state.quote.timestamp)
    : "Waiting for data";
}

function renderAll() {
  renderUpdatedAt();
  renderCards();
  renderMetrics();
  renderConversion();
}

async function loadQuote() {
  setStatus("Refreshing quote...");
  const data = await fetchQuote();

  state.quote = data;
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
