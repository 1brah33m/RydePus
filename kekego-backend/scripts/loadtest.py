"""Standalone HTTP load smoke test for a running deployment.

Hit a deployed API concurrently and report latency percentiles. Everything is
done with the standard library; no test runner or server hooks required.

Usage::

    python scripts/loadtest.py --url http://localhost:8000/api/v1/health/ \
        --requests 200 --concurrency 8

    # Airtime for an authenticated endpoint:
    BEARER_TOKEN=eyJ... python scripts/loadtest.py --url http://localhost:8000/api/v1/groups/

Exit code is non-zero when the p95 latency exceeds ``--max-p95-ms``.
"""

import argparse
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

DEFAULT_URL = "http://localhost:8000/api/v1/health/"


def one_request(url: str, token: str | None) -> tuple[int, float]:
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
    started = time.perf_counter()
    with urllib.request.urlopen(request, timeout=20) as response:
        status_code = response.status
        response.read()
    return status_code, (time.perf_counter() - started) * 1000


def main() -> None:
    parser = argparse.ArgumentParser(description="HTTP load smoke test.")
    parser.add_argument("--url", default=DEFAULT_URL, help="Endpoint to hammer.")
    parser.add_argument("--requests", type=int, default=200)
    parser.add_argument("--concurrency", type=int, default=8)
    parser.add_argument("--max-p95-ms", type=float, default=1000.0)
    parser.add_argument("--token", default=None, help="Bearer token (or set BEARER_TOKEN).")
    args = parser.parse_args()

    token = args.token or __import__("os").environ.get("BEARER_TOKEN")
    latencies: list[tuple[int, float]] = []

    def run(_):
        code, ms = one_request(args.url, token)
        latencies.append((code, ms))

    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        list(pool.map(run, range(args.requests)))

    codes = [code for code, _ in latencies]
    durations = sorted(ms for _, ms in latencies)
    p50 = durations[len(durations) // 2]
    p95 = durations[int(len(durations) * 0.95)]
    failures = sum(1 for c in codes if c >= 400)

    print(f"url={args.url} requests={len(latencies)} concurrency={args.concurrency}")
    print(f"status_codes={ {c: codes.count(c) for c in set(codes)} }")
    print(f"p50={p50:.1f}ms p95={p95:.1f}ms max={max(durations):.1f}ms failures={failures}")

    if failures:
        raise SystemExit(1)
    if p95 > args.max_p95_ms:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
