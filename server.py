from __future__ import annotations

import base64
import json
import os
import socket
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import ProxyHandler, Request, build_opener


HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8000"))
STREAM_URL_TEMPLATE = "https://labs-api.oanda.com/v2/rates?instruments={instrument}&division=MKTD"
BITKUB_DEPTH_URL = "https://api.bitkub.com/api/market/depth?sym=THB_USDT&lmt=1"
COINBASE_BOOK_URL = "https://api.exchange.coinbase.com/products/USDT-USD/book?level=1"
BASE_DIR = Path(__file__).resolve().parent
NO_PROXY_OPENER = build_opener(ProxyHandler({}))
UPSTREAM_ERRORS = (
    TimeoutError,
    socket.timeout,
    URLError,
    RuntimeError,
    json.JSONDecodeError,
    base64.binascii.Error,
    KeyError,
    IndexError,
    ValueError,
)


def strip_padding(value: str) -> str:
    return value.split("=")[0]


def factor_pair(length: int) -> tuple[int, int]:
    target = length + (length % 2)
    left = 1
    right = 1
    factor = 2

    while target > 1:
      while target % factor == 0:
        if left < right:
          left *= factor
        else:
          right *= factor
        target //= factor
      factor += 1

    return (left, right) if left <= right else (right, left)


def unscramble(value: str) -> str:
    width, height = factor_pair(len(value))
    rows = [list(value[index : index + width]) for index in range(0, len(value), width)]
    output: list[str] = []

    for position in range(len(value)):
        row_index = position % height if (position // height) % 2 == 0 else height - 1 - (position % height)
        output.append(rows[row_index].pop(0) if row_index % 2 == 0 else rows[row_index].pop())

    return "".join(output)


def decode_oanda_payload(encoded: str) -> dict[str, Any]:
    scrambled = unscramble(strip_padding(encoded))
    padded = scrambled + ("=" * (-len(scrambled) % 4))
    decoded = base64.b64decode(padded)
    return json.loads(decoded.decode("utf-8"))


def fetch_oanda_quote(instrument: str) -> dict[str, Any]:
    request = Request(
        STREAM_URL_TEMPLATE.format(instrument=instrument),
        headers={
            "Accept": "text/event-stream",
            "User-Agent": "QuoteRate/1.0",
        },
    )

    with NO_PROXY_OPENER.open(request, timeout=10) as response:
        for raw_line in response:
            line = raw_line.decode("utf-8", "ignore").strip()
            if not line or not line.startswith("data:"):
                continue

            encoded = line.split("data:", 1)[1].strip()
            return decode_oanda_payload(encoded)

    raise RuntimeError("No OANDA rate event received")


def fetch_json(url: str, headers: dict[str, str] | None = None) -> dict[str, Any]:
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; QuoteRate/1.0)",
            "Origin": "https://www.google.com",
            **(headers or {}),
        },
    )

    with NO_PROXY_OPENER.open(request, timeout=10) as response:
        return json.load(response)


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def fetch_bitkub_usdt_thb_quote() -> dict[str, Any]:
    payload = fetch_json(BITKUB_DEPTH_URL)
    result = payload.get("result")
    book = result if isinstance(result, dict) else payload
    bids = book.get("bids", [])
    asks = book.get("asks", [])

    if not bids or not asks:
        raise RuntimeError("Bitkub order book is missing bids or asks")

    return {
        "symbol": "USDT_THB",
        "bid": float(bids[0][0]),
        "ask": float(asks[0][0]),
        "timestamp": iso_now(),
        "source": "Bitkub",
    }


def fetch_coinbase_usdt_usd_quote() -> dict[str, Any]:
    payload = fetch_json(COINBASE_BOOK_URL)
    bids = payload.get("bids", [])
    asks = payload.get("asks", [])

    if not bids or not asks:
        raise RuntimeError("Coinbase order book is missing bids or asks")

    return {
        "symbol": "USDT-USD",
        "bid": float(bids[0][0]),
        "ask": float(asks[0][0]),
        "timestamp": payload.get("time") or iso_now(),
        "source": "Coinbase",
    }


def try_fetch(fetcher: Any, *args: Any) -> tuple[dict[str, Any] | None, str | None]:
    try:
        return fetcher(*args), None
    except UPSTREAM_ERRORS as error:
        return None, str(error)


def build_dashboard_payload() -> dict[str, Any]:
    usd_thb, usd_thb_error = try_fetch(fetch_oanda_quote, "USD_THB")
    eur_usd, eur_usd_error = try_fetch(fetch_oanda_quote, "EUR_USD")
    usdt_thb, usdt_thb_error = try_fetch(fetch_bitkub_usdt_thb_quote)
    usdt_usd, usdt_usd_error = try_fetch(fetch_coinbase_usdt_usd_quote)

    if not any((usd_thb, eur_usd, usdt_thb, usdt_usd)):
        raise RuntimeError("All upstream market feeds are unavailable")

    derived: dict[str, float | None] = {
        "eur_thb_mid": None,
        "usd_thb_fee_1pct": None,
        "usd_thb_fee_3pct": None,
        "usdt_thb_mid": None,
        "usdt_usd_mid": None,
    }

    if usd_thb:
        usd_thb_mid = (usd_thb["bid"] + usd_thb["ask"]) / 2
        derived["usd_thb_fee_1pct"] = round(usd_thb_mid * 1.01, 6)
        derived["usd_thb_fee_3pct"] = round(usd_thb_mid * 1.03, 6)

        if eur_usd:
            eur_usd_mid = (eur_usd["bid"] + eur_usd["ask"]) / 2
            derived["eur_thb_mid"] = round(eur_usd_mid * usd_thb_mid, 6)

    if usdt_thb:
        usdt_thb_mid = (usdt_thb["bid"] + usdt_thb["ask"]) / 2
        derived["usdt_thb_mid"] = round(usdt_thb_mid, 6)

    if usdt_usd:
        usdt_usd_mid = (usdt_usd["bid"] + usdt_usd["ask"]) / 2
        derived["usdt_usd_mid"] = round(usdt_usd_mid, 6)

    return {
        "usd_thb": usd_thb,
        "eur_usd": eur_usd,
        "usdt_thb": usdt_thb,
        "usdt_usd": usdt_usd,
        "derived": derived,
        "source_errors": {
            "usd_thb": usd_thb_error,
            "eur_usd": eur_usd_error,
            "usdt_thb": usdt_thb_error,
            "usdt_usd": usdt_usd_error,
        },
    }


class QuoteRateHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)

        if parsed.path == "/api/usd-thb":
            self.handle_usd_thb()
            return

        if parsed.path == "/api/dashboard":
            self.handle_dashboard()
            return

        if parsed.path == "/healthz":
            self.send_json({"ok": True})
            return

        super().do_GET()

    def handle_usd_thb(self) -> None:
        try:
            payload = fetch_oanda_quote("USD_THB")
            self.send_json(payload)
        except UPSTREAM_ERRORS as error:
            self.send_json({"error": str(error)}, status=502)

    def handle_dashboard(self) -> None:
        try:
            payload = build_dashboard_payload()
            self.send_json(payload)
        except UPSTREAM_ERRORS as error:
            self.send_json({"error": str(error)}, status=502)

    def send_json(self, payload: dict[str, Any], status: int = 200) -> None:
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format: str, *args: Any) -> None:
        return super().log_message(format, *args)


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), QuoteRateHandler)
    print(f"Serving QuoteRate on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
