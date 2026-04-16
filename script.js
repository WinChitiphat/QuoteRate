const API_BASE = "https://open.er-api.com/v6/latest";
const FEATURED_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "THB", "AUD", "CAD"];

const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });

const state = {
  currencies: {},
  base: "USD",
  rates: {},
  amount: 100,
  from: "USD",
  to: "THB",
  lastUpdated: null,
  nextUpdated: null,
};

const elements = {
  baseCurrency: document.getElementById("baseCurrency"),
  fromCurrency: document.getElementById("fromCurrency"),
  toCurrency: document.getElementById("toCurrency"),
  amountInput: document.getElementById("amountInput"),
  searchInput: document.getElementById("searchInput"),
  rateCards: document.getElementById("rateCards"),
  ratesTableBody: document.getElementById("ratesTableBody"),
  conversionResult: document.getElementById("conversionResult"),
  conversionDetail: document.getElementById("conversionDetail"),
  statusText: document.getElementById("statusText"),
  updatedText: document.getElementById("updatedText"),
  nextUpdatedText: document.getElementById("nextUpdatedText"),
  refreshButton: document.getElementById("refreshButton"),
  swapButton: document.getElementById("swapButton"),
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const data = await response.json();
  if (data.result && data.result !== "success") {
    throw new Error(`API returned ${data.result}`);
  }

  return data;
}

function getCurrencyName(code) {
  try {
    return currencyNames.of(code) || code;
  } catch {
    return code;
  }
}

function buildCurrenciesFromRates(rates) {
  const codes = new Set([state.base, ...Object.keys(rates)]);
  state.currencies = Object.fromEntries(
    [...codes]
      .sort((a, b) => a.localeCompare(b))
      .map((code) => [code, getCurrencyName(code)])
  );
}

function currencyOptionsMarkup() {
  return Object.entries(state.currencies)
    .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
    .map(([code, name]) => `<option value="${code}">${code} - ${name}</option>`)
    .join("");
}

function populateCurrencySelects() {
  const options = currencyOptionsMarkup();
  elements.baseCurrency.innerHTML = options;
  elements.fromCurrency.innerHTML = options;
  elements.toCurrency.innerHTML = options;

  elements.baseCurrency.value = state.base;
  elements.fromCurrency.value = state.from;
  elements.toCurrency.value = state.to;
}

async function loadRates() {
  setStatus("Loading rates...");

  const data = await fetchJson(`${API_BASE}/${state.base}`);
  state.rates = data.rates;
  state.lastUpdated = data.time_last_update_utc || null;
  state.nextUpdated = data.time_next_update_utc || null;

  buildCurrenciesFromRates(state.rates);
  populateCurrencySelects();
  renderAll();
  setStatus("Rates checked");
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

function renderUpdatedAt() {
  if (!state.lastUpdated) {
    elements.updatedText.textContent = "Unavailable";
    elements.nextUpdatedText.textContent = "Unavailable";
    return;
  }

  const parsed = new Date(state.lastUpdated);
  elements.updatedText.textContent = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);

  if (!state.nextUpdated) {
    elements.nextUpdatedText.textContent = "Unavailable";
    return;
  }

  const nextParsed = new Date(state.nextUpdated);
  elements.nextUpdatedText.textContent = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(nextParsed);
}

function getRate(code) {
  if (code === state.base) {
    return 1;
  }

  return state.rates[code];
}

function renderConversion() {
  const amount = Number(elements.amountInput.value || 0);
  state.amount = amount;
  state.from = elements.fromCurrency.value;
  state.to = elements.toCurrency.value;

  const fromRate = getRate(state.from);
  const toRate = getRate(state.to);

  if (!fromRate || !toRate) {
    elements.conversionResult.textContent = "Unavailable";
    elements.conversionDetail.textContent = "The selected pair is not available from the current base.";
    return;
  }

  const converted = amount * (toRate / fromRate);
  const unitRate = toRate / fromRate;

  elements.conversionResult.textContent = `${formatNumber(converted, 2)} ${state.to}`;
  elements.conversionDetail.textContent = `1 ${state.from} = ${formatNumber(unitRate, 6)} ${state.to}`;
}

function renderCards() {
  const cards = FEATURED_CURRENCIES.filter((code) => code !== state.base)
    .slice(0, 5)
    .map((code) => {
      const rate = getRate(code);
      if (!rate) {
        return "";
      }

      return `
        <article class="rate-card">
          <span class="rate-pair">${state.base} / ${code}</span>
          <strong class="rate-value">${formatNumber(rate, 4)}</strong>
        </article>
      `;
    })
    .join("");

  elements.rateCards.innerHTML = cards || '<p class="empty-state">No featured rates available.</p>';
}

function renderTable() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const rows = Object.entries(state.currencies)
    .filter(([code, name]) => {
      if (!query) {
        return true;
      }

      return code.toLowerCase().includes(query) || name.toLowerCase().includes(query);
    })
    .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
    .map(([code, name]) => {
      const rate = getRate(code);
      return `
        <tr>
          <td>${code}</td>
          <td>${name}</td>
          <td>${rate ? formatNumber(rate, 6) : "1.000000"}</td>
        </tr>
      `;
    })
    .join("");

  elements.ratesTableBody.innerHTML = rows || `
    <tr>
      <td colspan="3" class="empty-state">No currencies match your search.</td>
    </tr>
  `;
}

function renderAll() {
  renderUpdatedAt();
  renderCards();
  renderTable();
  renderConversion();
}

function swapCurrencies() {
  const previousFrom = elements.fromCurrency.value;
  elements.fromCurrency.value = elements.toCurrency.value;
  elements.toCurrency.value = previousFrom;
  renderConversion();
}

function bindEvents() {
  elements.baseCurrency.addEventListener("change", async (event) => {
    state.base = event.target.value;
    await loadRates();
  });

  elements.fromCurrency.addEventListener("change", renderConversion);
  elements.toCurrency.addEventListener("change", renderConversion);
  elements.amountInput.addEventListener("input", renderConversion);
  elements.searchInput.addEventListener("input", renderTable);
  elements.swapButton.addEventListener("click", swapCurrencies);
  elements.refreshButton.addEventListener("click", () => {
    loadRates().catch(handleError);
  });
}

async function init() {
  try {
    bindEvents();
    await loadRates();

    window.setInterval(() => {
      loadRates().catch(handleError);
    }, 30_000);
  } catch (error) {
    handleError(error);
  }
}

function handleError(error) {
  console.error(error);
  setStatus("Unable to load rates");
  elements.updatedText.textContent = "Check connection";
  elements.nextUpdatedText.textContent = "Check connection";
  elements.conversionResult.textContent = "Error";
  elements.conversionDetail.textContent = "The API could not be reached right now.";
  elements.rateCards.innerHTML = '<p class="empty-state">Could not load featured rates.</p>';
  elements.ratesTableBody.innerHTML = `
    <tr>
      <td colspan="3" class="empty-state">Unable to load exchange rates right now.</td>
    </tr>
  `;
}

init();
