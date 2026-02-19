#!/usr/bin/env python3
"""Simple rate-limit tester (no external deps).

Sends a burst of HTTP requests concurrently and reports how many responses
were rate-limited (HTTP 429), plus basic timing stats.

Examples:
  python3 scripts/test_rate_limit.py --url http://127.0.0.1/api/health --requests 200 --concurrency 50
  python3 scripts/test_rate_limit.py --url http://127.0.0.1/api/register --method POST --json '{"username":"u1"}'

Notes:
- For Gauzian local dev, Caddy listens on :80, and proxies /api/* to the backend.
- Prefer a cheap endpoint (even a 404) to avoid polluting the DB.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import statistics
import time
import urllib.parse
import http.client
from typing import Optional, Tuple, Dict, Any


def _single_request(
    url: str,
    method: str,
    body: Optional[bytes],
    headers: Dict[str, str],
    timeout: float,
) -> Tuple[int, float, Optional[str]]:
    parsed = urllib.parse.urlparse(url)
    scheme = parsed.scheme.lower()
    if scheme not in {"http", "https"}:
        raise ValueError(f"Unsupported scheme: {parsed.scheme}")

    host = parsed.hostname
    if not host:
        raise ValueError("URL must include a host")

    port = parsed.port
    if port is None:
        port = 443 if scheme == "https" else 80

    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"

    conn_cls = http.client.HTTPSConnection if scheme == "https" else http.client.HTTPConnection

    start = time.perf_counter()
    conn = conn_cls(host, port, timeout=timeout)
    try:
        conn.request(method, path, body=body, headers=headers)
        resp = conn.getresponse()
        # consume response to release the connection cleanly
        resp.read()
        duration = time.perf_counter() - start
        retry_after = resp.getheader("Retry-After")
        return resp.status, duration, retry_after
    finally:
        try:
            conn.close()
        except Exception:
            pass


def main() -> int:
    p = argparse.ArgumentParser(description="Burst tester for HTTP rate limits.")
    p.add_argument("--url", required=True, help="Target URL (e.g. http://127.0.0.1/api/health)")
    p.add_argument("--requests", type=int, default=200, help="Total number of requests to send")
    p.add_argument("--concurrency", type=int, default=50, help="Number of worker threads")
    p.add_argument("--method", default="GET", help="HTTP method (GET/POST/...) ")
    p.add_argument("--json", dest="json_body", help="JSON body as a string (implies Content-Type: application/json)")
    p.add_argument("--timeout", type=float, default=5.0, help="Per-request timeout (seconds)")
    args = p.parse_args()

    total = max(1, args.requests)
    concurrency = max(1, min(args.concurrency, total))
    method = args.method.upper().strip()

    headers: Dict[str, str] = {
        "User-Agent": "gauzian-rate-limit-tester/1.0",
        "Connection": "close",
    }
    body: Optional[bytes] = None

    if args.json_body is not None:
        # Validate it's JSON, but keep bytes exactly as provided
        try:
            json.loads(args.json_body)
        except json.JSONDecodeError as e:
            raise SystemExit(f"Invalid --json payload: {e}")
        body = args.json_body.encode("utf-8")
        headers["Content-Type"] = "application/json"
        headers["Content-Length"] = str(len(body))

    print(f"Target: {args.url}")
    print(f"Requests: {total} | Concurrency: {concurrency} | Method: {method}")

    statuses = []
    durations = []
    retry_after_values = []

    t0 = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as ex:
        futures = [
            ex.submit(_single_request, args.url, method, body, headers, args.timeout)
            for _ in range(total)
        ]
        for fut in concurrent.futures.as_completed(futures):
            status, dur, retry_after = fut.result()
            statuses.append(status)
            durations.append(dur)
            if retry_after:
                retry_after_values.append(retry_after)

    elapsed = time.perf_counter() - t0

    def count(code: int) -> int:
        return sum(1 for s in statuses if s == code)

    c429 = count(429)
    by_class: Dict[str, int] = {
        "2xx": sum(1 for s in statuses if 200 <= s < 300),
        "3xx": sum(1 for s in statuses if 300 <= s < 400),
        "4xx": sum(1 for s in statuses if 400 <= s < 500),
        "5xx": sum(1 for s in statuses if 500 <= s < 600),
    }

    durations_ms = [d * 1000.0 for d in durations]
    p50 = statistics.median(durations_ms)
    p95 = statistics.quantiles(durations_ms, n=20)[18] if len(durations_ms) >= 20 else max(durations_ms)

    print("\nResults")
    print(f"- Elapsed: {elapsed:.3f}s | Throughput: {total / elapsed:.1f} req/s")
    print(f"- Status classes: {by_class} (429={c429})")
    print(f"- Latency: p50={p50:.1f}ms p95≈{p95:.1f}ms max={max(durations_ms):.1f}ms")

    if retry_after_values:
        # show a few distinct values
        distinct = sorted({v for v in retry_after_values})
        print(f"- Retry-After (sample): {', '.join(distinct[:5])}{' …' if len(distinct) > 5 else ''}")

    # exit code is non-zero if no rate limiting observed (useful for CI/manual checks)
    return 0 if c429 > 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
