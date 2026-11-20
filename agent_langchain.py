"""FastAPI entry point for Ops Copilot."""

import os

from contextlib import asynccontextmanager
from typing import Annotated, Literal

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, StringConstraints

from ops_copilot import (
    MAX_HISTORY_CONTENT,
    MAX_HISTORY_MESSAGES,
    MAX_MESSAGE_LENGTH,
    ChatResult,
    Settings,
    answer,
)


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_HISTORY_CONTENT)
    ]


class ChatRequest(BaseModel):
    message: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_MESSAGE_LENGTH)
    ]
    history: list[HistoryMessage] = Field(default_factory=list, max_length=MAX_HISTORY_MESSAGES)


def create_app() -> FastAPI:
    settings = Settings.from_env()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        application.state.provider = None
        if not settings.gemini_key:
            yield
            return
        async with httpx.AsyncClient(
            base_url="https://generativelanguage.googleapis.com",
            timeout=httpx.Timeout(4, connect=2),
            limits=httpx.Limits(max_connections=8, max_keepalive_connections=4),
        ) as provider:
            application.state.provider = provider
            yield

    application = FastAPI(
        title="Ops Copilot", description="IT support triage from the shared runbook catalog.", lifespan=lifespan
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @application.get("/")
    async def index():
        return {"status": "ok"}

    @application.get("/health")
    async def health():
        return {"status": "ok", "mode": "gemini" if settings.gemini_key else "demo"}

    @application.post("/chat", response_model=ChatResult)
    async def chat(body: ChatRequest, request: Request):
        history = [message.content for message in body.history if message.role == "user"]
        provider = request.app.state.provider

        if provider is not None and os.getenv("OPS_PUBLIC_CHAT_ENABLED") == "1":
            from gemini_quota import reserve_gemini_slot

            if not await reserve_gemini_slot():
                provider = None

        return await answer(body.message, history, settings, provider)

    return application


app = create_app()
