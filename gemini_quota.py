"""Shared, fail-closed Gemini request budget using Upstash REST."""

import logging
import os
from datetime import datetime, timezone

import httpx

LOGGER = logging.getLogger(__name__)

MINUTE_LIMIT = 10
DAILY_LIMIT = 30

SCRIPT = """
local minute = tonumber(redis.call('GET', KEYS[1]) or '0')
local daily = tonumber(redis.call('GET', KEYS[2]) or '0')

if minute >= tonumber(ARGV[1]) or daily >= tonumber(ARGV[2]) then
    return 0
end

local m = redis.call('INCR', KEYS[1])
if m == 1 then
    redis.call('EXPIRE', KEYS[1], 120)
end

local d = redis.call('INCR', KEYS[2])
if d == 1 then
    redis.call('EXPIRE', KEYS[2], 172800)
end

return 1
"""


async def reserve_gemini_slot() -> bool:
    """Reserve one shared Gemini request or deny it safely."""
    url = os.getenv("KV_REST_API_URL", "").rstrip("/")
    token = os.getenv("KV_REST_API_TOKEN", "")

    if not url.startswith("https://") or not token:
        return False

    now = datetime.now(timezone.utc)
    minute_key = f"ops:gemini:minute:{now:%Y%m%d%H%M}"
    daily_key = f"ops:gemini:day:{now:%Y%m%d}"

    command = [
        "EVAL",
        SCRIPT,
        2,
        minute_key,
        daily_key,
        MINUTE_LIMIT,
        DAILY_LIMIT,
    ]

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.post(
                url,
                headers={"Authorization": f"Bearer {token}"},
                json=command,
            )
            response.raise_for_status()
            data = response.json()
            return isinstance(data, dict) and data.get("result") == 1
    except (httpx.HTTPError, ValueError, TypeError):
        LOGGER.warning("Gemini quota unavailable; use demo fallback.")
        return False
