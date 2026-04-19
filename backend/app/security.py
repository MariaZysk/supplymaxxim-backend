"""Shared auth + CORS helpers for the FastAPI backends.

- `require_api_key` is a FastAPI dependency that enforces an `X-API-Key` header
  matching the `SPHEREMAXXING_API_KEY` env var. If the env var is unset/empty,
  the dependency is a no-op so local dev keeps working without configuration.
- `allowed_cors_origins` reads the `ALLOWED_ORIGINS` env var (comma-separated)
  and falls back to safe localhost defaults. It avoids the dangerous `*` value.
"""

from __future__ import annotations

import os
import secrets

from fastapi import Header, HTTPException, status

_DEFAULT_DEV_ORIGINS = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def _expected_api_key() -> str:
    return (os.getenv("SPHEREMAXXING_API_KEY") or "").strip()


async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Reject requests without a matching `X-API-Key` header.

    No-op when `SPHEREMAXXING_API_KEY` is unset (local dev convenience).
    Uses constant-time comparison to avoid timing attacks.
    """
    expected = _expected_api_key()
    if not expected:
        return
    provided = (x_api_key or "").strip()
    if not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )


def allowed_cors_origins() -> list[str]:
    """Parse `ALLOWED_ORIGINS` env var; fall back to localhost dev origins."""
    raw = (os.getenv("ALLOWED_ORIGINS") or "").strip()
    if not raw:
        return list(_DEFAULT_DEV_ORIGINS)
    origins = [o.strip() for o in raw.split(",") if o.strip() and o.strip() != "*"]
    return origins or list(_DEFAULT_DEV_ORIGINS)
