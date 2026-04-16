from __future__ import annotations

import base64
import json
import os
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8000"))
STREAM_URL_TEMPLATE = "https://labs-api.oanda.com/v2/rates?instruments={instrument}&division=MKTD"
BASE_DIR = Path(__file__).resolve().parent


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

    with urlopen(request, timeout=10) as response:
        for raw_line in response:
            line = raw_line.decode("utf-8", "ignore").strip()
            if not line or not line.startswith("data:"):
                continue

            encoded = line.split("data:", 1)[1].strip()
            return decode_oanda_payload(encoded)

    raise RuntimeError("No OANDA rate event received")


def build_dashboard_payload() -> dict[str, Any]:
    usd_thb = fetch_oanda_quote("USD_THB")
    eur_usd = fetch_oanda_quote("EUR_USD")

    usd_thb_mid = (usd_thb["bid"] + usd_thb["ask"]) / 2
    eur_usd_mid = (eur_usd["bid"] + eur_usd["ask"]) / 2
    eur_thb_mid = eur_usd_mid * usd_thb_mid

    return {
        "usd_thb": usd_thb,
        "eur_usd": eur_usd,
        "derived": {
            "eur_thb_mid": round(eur_thb_mid, 6),
            "usd_thb_fee_1pct": round(usd_thb_mid * 1.01, 6),
            "usd_thb_fee_3pct": round(usd_thb_mid * 1.03, 6),
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
        except (TimeoutError, socket.timeout, URLError, RuntimeError, json.JSONDecodeError, base64.binascii.Error) as error:
            self.send_json({"error": str(error)}, status=502)

    def handle_dashboard(self) -> None:
        try:
            payload = build_dashboard_payload()
            self.send_json(payload)
        except (TimeoutError, socket.timeout, URLError, RuntimeError, json.JSONDecodeError, base64.binascii.Error, KeyError) as error:
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
