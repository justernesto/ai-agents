"""Terminal entry point for the same runbooks served by the API."""

import argparse
import asyncio
import os
from contextlib import AsyncExitStack

import httpx

from ops_copilot import MAX_HISTORY_MESSAGES, MAX_MESSAGE_LENGTH, Settings, answer


async def main():
    parser = argparse.ArgumentParser(description="Run Ops Copilot in your terminal.")
    parser.add_argument("prompt", nargs="?")
    parser.add_argument("--model", help="Override GEMINI_MODEL if Gemini is enabled.")
    args = parser.parse_args()
    if args.model:
        os.environ["GEMINI_MODEL"] = args.model
    settings = Settings.from_env()
    async with AsyncExitStack() as stack:
        provider = None
        if settings.gemini_key:
            provider = await stack.enter_async_context(httpx.AsyncClient(
                base_url="https://generativelanguage.googleapis.com",
                timeout=httpx.Timeout(4, connect=2),
            ))
        if args.prompt is not None:
            message = args.prompt.strip()
            if not 1 <= len(message) <= MAX_MESSAGE_LENGTH:
                parser.error(f"Enter a prompt of 1 to {MAX_MESSAGE_LENGTH} characters.")
            print((await answer(message, [], settings, provider)).reply)
            return

        print("Ops Copilot. Ask about connectivity, DNS, MFA, or a handoff.")
        print("Use /clear_history to start fresh or /exit to leave.")
        history = []
        while True:
            try:
                message = input("\nYou: ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                break
            if message.lower() in {"/exit", "/quit"}:
                break
            if message.lower() == "/clear_history":
                history.clear()
                print("Conversation cleared.")
                continue
            if not message:
                continue
            if len(message) > MAX_MESSAGE_LENGTH:
                print(f"Keep your message under {MAX_MESSAGE_LENGTH} characters.")
                continue
            result = await answer(message, history, settings, provider)
            print(f"\nOps Copilot ({result.mode})\n{result.reply}")
            history = [*history, message][-MAX_HISTORY_MESSAGES:]


if __name__ == "__main__":
    asyncio.run(main())
