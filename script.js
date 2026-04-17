const API_URL = "/api/dashboard";
const PAIR = "USD/THB";
const POLL_INTERVAL_MS = 60_000;
const state = {
  amount: 100,
  from: "USD",
  to: "THB",
  dashboard: null,
};

const elements = {
  amountInput: document.getElementById("amountInput"),
  fromCurrency: document.getElementById("fromCurrency"),
  toCurrency: document.getElementById("toCurrency"),
  heroSpreadUsdPrice: document.getElementById("heroSpreadUsdPrice"),
  heroSpreadUsdDetail: document.getElementById("heroSpreadUsdDetail"),
  heroSpreadUsdBase: document.getElementById("heroSpreadUsdBase"),
  heroSpreadUsdAdjusted: document.getElementById("heroSpreadUsdAdjusted"),
  heroSpreadUsdBid: document.getElementById("heroSpreadUsdBid"),
  heroSpreadUsdAsk: document.getElementById("heroSpreadUsdAsk"),
  heroSpreadEurPrice: document.getElementById("heroSpreadEurPrice"),
  heroSpreadEurDetail: document.getElementById("heroSpreadEurDetail"),
  heroSpreadEurBase: document.getElementById("heroSpreadEurBase"),
  heroSpreadEurAdjusted: document.getElementById("heroSpreadEurAdjusted"),
  heroSpreadEurBid: document.getElementById("heroSpreadEurBid"),
  heroSpreadEurAsk: document.getElementById("heroSpreadEurAsk"),
  rateCards: document.getElementById("rateCards"),
  metricsTableBody: document.getElementById("metricsTableBody"),
  conversionResult: document.getElementById("conversionResult"),
  conversionDetail: document.getElementById("conversionDetail"),
  statusText: document.getElementById("statusText"),
  updatedText: document.getElementById("updatedText"),
  refreshButton: document.getElementById("refreshButton"),
  swapButton: document.getElementById("swapButton"),
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

function getConversionRate(from, to) {
  const usdMid = getUsdMid();
  const eurMid = getEurDerivedQuote()?.mid ?? null;
  const eurUsdMid = getEurUsdMid();
  const usdtThbMid = getDerivedRates()?.usdt_thb_mid ?? null;
  const usdtUsdMid = getDerivedRates()?.usdt_usd_mid ?? null;
  const eurUsdtMid = eurUsdMid && usdtUsdMid ? eurUsdMid / usdtUsdMid : null;
  const usdUsdtMid = usdtUsdMid ? 1 / usdtUsdMid : null;

  if (from === to) {
    return { rate: 1, label: `1 ${to} per ${from}` };
  }

  const rates = {
    "USD/THB": usdMid,
    "THB/USD": usdMid ? 1 / usdMid : null,
    "EUR/THB": eurMid,
    "THB/EUR": eurMid ? 1 / eurMid : null,
    "EUR/USD": eurUsdMid,
    "USD/EUR": eurUsdMid ? 1 / eurUsdMid : null,
    "USDT/THB": usdtThbMid,
    "THB/USDT": usdtThbMid ? 1 / usdtThbMid : null,
    "USDT/USD": usdtUsdMid,
    "USD/USDT": usdUsdtMid,
    "EUR/USDT": eurUsdtMid,
    "USDT/EUR": eurUsdtMid ? 1 / eurUsdtMid : null,
  };

  const pair = `${from}/${to}`;
  const rate = rates[pair];

  if (!rate) {
    return null;
  }

  return {
    rate,
    label: `${to} per ${from}`,
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
    elements.heroSpreadUsdBase,
    elements.heroSpreadUsdAdjusted,
    elements.heroSpreadUsdBid,
    elements.heroSpreadUsdAsk,
    elements.heroSpreadEurPrice,
    elements.heroSpreadEurBase,
    elements.heroSpreadEurAdjusted,
    elements.heroSpreadEurBid,
    elements.heroSpreadEurAsk,
  ];

  placeholders.forEach((element) => {
    element.textContent = "--.--";
  });

  elements.heroSpreadUsdDetail.textContent = "Waiting for the first quote.";
  elements.heroSpreadEurDetail.textContent = "Waiting for the first quote.";
}

function renderHeroQuote() {
  const usdQuote = getUsdThbQuote();
  const eurQuote = getEurDerivedQuote();

  if (!usdQuote || !eurQuote) {
    resetHeroCards();
    return;
  }

  const usdMid = getUsdMid();
  const usdSpread = usdQuote.ask - usdQuote.bid;

  elements.heroSpreadUsdPrice.textContent = formatNumber(usdMid, 3);
  elements.heroSpreadUsdDetail.textContent = `Quote timestamp ${formatDateTime(usdQuote.timestamp)}.`;
  elements.heroSpreadUsdBase.textContent = formatNumber(usdMid, 3);
  elements.heroSpreadUsdAdjusted.textContent = formatNumber(usdSpread, 3);
  elements.heroSpreadUsdBid.textContent = formatNumber(usdQuote.bid, 3);
  elements.heroSpreadUsdAsk.textContent = formatNumber(usdQuote.ask, 3);

  elements.heroSpreadEurPrice.textContent = formatNumber(eurQuote.mid, 3);
  elements.heroSpreadEurDetail.textContent = `Quote timestamp ${formatDateTime(eurQuote.timestamp)}.`;
  elements.heroSpreadEurBase.textContent = formatNumber(eurQuote.mid, 3);
  elements.heroSpreadEurAdjusted.textContent = formatNumber(eurQuote.spread, 3);
  elements.heroSpreadEurBid.textContent = formatNumber(eurQuote.bid, 3);
  elements.heroSpreadEurAsk.textContent = formatNumber(eurQuote.ask, 3);

  animateHeroSpreadCards();
}

function renderConversion() {
  const amount = Number(elements.amountInput.value || 0);
  state.amount = amount;
  state.from = elements.fromCurrency.value;
  state.to = elements.toCurrency.value;

  const conversion = getConversionRate(state.from, state.to);
  if (!conversion) {
    elements.conversionResult.textContent = "Loading...";
    elements.conversionDetail.textContent = "Waiting for the latest quote for this pair.";
    return;
  }

  const converted = amount * conversion.rate;

  elements.conversionResult.textContent = `${formatNumber(converted, 2)} ${state.to}`;
  elements.conversionDetail.textContent = `Using midpoint ${formatNumber(conversion.rate, 5)} ${conversion.label}`;
}

function renderCards() {
  const quote = getUsdThbQuote();
  const usdtThb = getUsdtThbQuote();
  const usdtUsd = getUsdtUsdQuote();
  const derived = getDerivedRates();

  if (!quote && !usdtThb && !usdtUsd && !derived?.eur_thb_mid) {
    elements.rateCards.innerHTML = '<p class="empty-state">Waiting for the first live quote.</p>';
    return;
  }

  const cards = [];

  if (quote) {
    const spread = quote.ask - quote.bid;
    const mid = getUsdMid();
    const closingMid = (quote.closingBid + quote.closingAsk) / 2;
    const delta = mid - closingMid;

    cards.push(`
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
        <span class="rate-pair">USD/THB Spread</span>
        <strong class="rate-value">${formatNumber(spread, 3)}</strong>
        <span class="rate-subvalue">Live OANDA spread</span>
      </article>
    `);
  }

  if (derived?.eur_thb_mid) {
    cards.push(`
      <article class="rate-card">
        <span class="rate-pair">EUR/THB</span>
        <strong class="rate-value">${formatNumber(derived.eur_thb_mid, 3)}</strong>
        <span class="rate-subvalue">Derived from EUR/USD and USD/THB</span>
      </article>
    `);
  }

  if (usdtThb) {
    cards.push(`
      <article class="rate-card">
        <span class="rate-pair">USDT/THB Bid</span>
        <strong class="rate-value">${formatNumber(usdtThb.bid, 3)}</strong>
        <span class="rate-subvalue">Best bid from Bitkub</span>
      </article>
      <article class="rate-card">
        <span class="rate-pair">USDT/THB Ask</span>
        <strong class="rate-value">${formatNumber(usdtThb.ask, 3)}</strong>
        <span class="rate-subvalue">Best ask from Bitkub</span>
      </article>
    `);
  }

  if (derived?.usdt_usd_mid) {
    cards.push(`
      <article class="rate-card">
        <span class="rate-pair">USDT/USD</span>
        <strong class="rate-value">${formatNumber(derived.usdt_usd_mid, 5)}</strong>
        <span class="rate-subvalue">Midpoint from Coinbase book</span>
      </article>
    `);
  }

  elements.rateCards.innerHTML = cards.join("");
}

function renderMetrics() {
  const quote = getUsdThbQuote();
  const usdtThb = getUsdtThbQuote();
  const usdtUsd = getUsdtUsdQuote();
  const derived = getDerivedRates();

  if (!quote && !usdtThb && !usdtUsd && !derived?.eur_thb_mid) {
    elements.metricsTableBody.innerHTML = `
      <tr>
        <td colspan="2" class="empty-state">Waiting for the first live quote.</td>
      </tr>
    `;
    return;
  }

  const rows = [];

  if (quote) {
    rows.push(
      ["Pair", PAIR],
      ["Timestamp", formatDateTime(quote.timestamp)],
      ["Opening Bid", formatNumber(quote.openingBid, 3)],
      ["Opening Ask", formatNumber(quote.openingAsk, 3)],
      ["Closing Bid", formatNumber(quote.closingBid, 3)],
      ["Closing Ask", formatNumber(quote.closingAsk, 3)],
      ["Session High", formatNumber(quote.high, 3)],
      ["Session Low", formatNumber(quote.low, 3)]
    );
  }

  if (state.dashboard?.eur_usd) {
    rows.push(["EUR/USD Mid", formatNumber((state.dashboard.eur_usd.bid + state.dashboard.eur_usd.ask) / 2, 5)]);
  }

  if (derived?.eur_thb_mid) {
    rows.push(["EUR/THB Mid", formatNumber(derived.eur_thb_mid, 3)]);
  }

  if (usdtThb) {
    rows.push(
      ["USDT/THB Bid (Bitkub)", formatNumber(usdtThb.bid, 3)],
      ["USDT/THB Ask (Bitkub)", formatNumber(usdtThb.ask, 3)]
    );
  }

  if (usdtUsd) {
    rows.push(
      ["USDT/USD Bid (Coinbase)", formatNumber(usdtUsd.bid, 5)],
      ["USDT/USD Ask (Coinbase)", formatNumber(usdtUsd.ask, 5)]
    );
  }

  if (derived?.usdt_usd_mid) {
    rows.push(["USDT/USD Mid (Coinbase)", formatNumber(derived.usdt_usd_mid, 5)]);
  }

  const errors = getSourceErrors();
  Object.entries(errors)
    .filter(([, value]) => Boolean(value))
    .forEach(([key, value]) => {
      rows.push([`${key} status`, `Unavailable`]);
    });

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
  const timestamps = [
    getUsdThbQuote()?.timestamp,
    getEurUsdQuote()?.timestamp,
    getUsdtThbQuote()?.timestamp,
    getUsdtUsdQuote()?.timestamp,
  ].filter(Boolean);

  elements.updatedText.textContent = timestamps.length ? formatDateTime(timestamps.sort().at(-1)) : "Waiting for data";
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

  renderAll();
  const errorCount = Object.values(getSourceErrors()).filter(Boolean).length;
  setStatus(errorCount ? "Live quote loaded with partial fallback" : "Live quote loaded");
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
  resetHeroCards();
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
