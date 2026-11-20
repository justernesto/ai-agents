import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app import app
from ops_copilot import ChatResult


class PublicQuotaTests(unittest.TestCase):
    def setUp(self):
        self.provider = object()
        app.state.provider = self.provider
        self.client = TestClient(app)
        self.body = {
            "message": "DNS lookup fails but IP connectivity works",
            "history": [],
        }

    def test_quota_approved(self):
        with patch("gemini_quota.reserve_gemini_slot", new_callable=AsyncMock) as quota:
            with patch("agent_langchain.answer", new_callable=AsyncMock) as answer:
                quota.return_value = True
                answer.return_value = ChatResult(
                    reply="Synthetic Gemini response",
                    mode="gemini",
                    sources=[],
                )

                result = self.client.post("/chat", json=self.body)

                self.assertEqual(result.status_code, 200)
                self.assertEqual(result.json()["mode"], "gemini")
                quota.assert_awaited_once()
                self.assertIs(answer.await_args.args[-1], self.provider)

    def test_quota_denied(self):
        with patch("gemini_quota.reserve_gemini_slot", new_callable=AsyncMock) as quota:
            with patch("agent_langchain.answer", new_callable=AsyncMock) as answer:
                quota.return_value = False
                answer.return_value = ChatResult(
                    reply="Synthetic runbook response",
                    mode="demo",
                    sources=[],
                )

                result = self.client.post("/chat", json=self.body)

                self.assertEqual(result.status_code, 200)
                self.assertEqual(result.json()["mode"], "demo")
                quota.assert_awaited_once()
                self.assertIsNone(answer.await_args.args[-1])


if __name__ == "__main__":
    unittest.main()
