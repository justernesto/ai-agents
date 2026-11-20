# Ops Copilot web demo

Ops Copilot is the browser interface for the AI Agents IT support prototype. It uses the same runbook catalog as the API.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Pick a sample scenario or describe an anonymized support issue. Browser demo mode runs locally and requires no API, account, or key.

To connect a running Ops Copilot API, set `NEXT_PUBLIC_OPS_API_URL` in `.env.local` to its base URL, such as `http://localhost:8000`. Restart the development server or rebuild for a deployed frontend after changing this variable. Choose **Connect configured API** in the interface to check its health and switch the session. Keep provider keys on the backend.

See the [project README](../README.md) for the API, runtime settings, and architecture.
