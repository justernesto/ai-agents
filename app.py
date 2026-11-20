"""Vercel entrypoint with public chat disabled by default."""

import os

from fastapi import Request
from fastapi.responses import JSONResponse

from agent_langchain import app


@app.middleware("http")
async def public_chat_guard(request: Request, call_next):
    if (
        request.method == "POST"
        and request.url.path.rstrip("/") == "/chat"
        and os.getenv("OPS_PUBLIC_CHAT_ENABLED") != "1"
    ):
        return JSONResponse(
            status_code=503,
            content={
                "detail": "Public chat is not enabled yet."
            },
        )

    return await call_next(request)
