const API_URL = "/api/dashboard";
const CACHE_KEY = "quoterate-dashboard-cache";
const HISTORY_KEY = "quoterate-usdthb-history";
const MAX_HISTORY_POINTS = 24;
const refreshNavButton = document.getElementById("refreshNavButton");

function writeDashboardCache(dashboard) {
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        dashboard,
        fetchedAt: Date.now(),
      }),
    );
  } catch (error) {
    console.warn("Unable to write dashboard cache", error);
  }
}

function readHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn("Unable to read USD/THB history", error);
    return [];
  }
}

function writeHistory(history) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn("Unable to write USD/THB history", error);
  }
}

function updateUsdThbHistory(dashboard) {
  const quote = dashboard?.usd_thb;
  if (!quote?.mid) {
    return;
  }

  const history = readHistory();
  history.push({
    value: quote.mid,
    timestamp: quote.timestamp || new Date().toISOString(),
  });

  writeHistory(history.slice(-MAX_HISTORY_POINTS));
}

async function refreshDashboardCache() {
  const response = await fetch(API_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const dashboard = await response.json();
  writeDashboardCache(dashboard);
  updateUsdThbHistory(dashboard);
  window.dispatchEvent(
    new CustomEvent("dashboard-refreshed", {
      detail: { dashboard },
    }),
  );
}

function setRefreshButtonState(label, disabled = false) {
  if (!refreshNavButton) {
    return;
  }

  refreshNavButton.textContent = label;
  refreshNavButton.setAttribute("aria-disabled", disabled ? "true" : "false");
  if (disabled) {
    refreshNavButton.classList.add("is-busy");
  } else {
    refreshNavButton.classList.remove("is-busy");
  }
}

if (refreshNavButton) {
  refreshNavButton.addEventListener("click", async (event) => {
    event.preventDefault();

    if (refreshNavButton.classList.contains("is-busy")) {
      return;
    }

    setRefreshButtonState("Refreshing...", true);

    try {
      await refreshDashboardCache();
      setRefreshButtonState("Updated");
    } catch (error) {
      console.warn("Unable to refresh dashboard cache", error);
      setRefreshButtonState("Try Again");
    }

    window.setTimeout(() => {
      setRefreshButtonState("Refresh Now");
    }, 1200);
  });
}
