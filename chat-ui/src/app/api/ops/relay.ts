import { HOSTED_OPS_API_URL } from "./config";

const timeoutMs = { health: 7000, chat: 18000 };

export async function relayOpsRequest(
  endpoint: keyof typeof timeoutMs,
  signal: AbortSignal,
  body?: ArrayBuffer,
): Promise<Response> {
  try {
    const upstream = await fetch(`${HOSTED_OPS_API_URL}/${endpoint}`, {
      method: endpoint === "chat" ? "POST" : "GET",
      headers: endpoint === "chat" ? { "Content-Type": "application/json" } : undefined,
      body,
      signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs[endpoint])]),
      cache: "no-store",
      redirect: "error",
    });
    const headers = new Headers({ "Cache-Control": "no-store" });
    const contentType = upstream.headers.get("Content-Type");
    if (contentType) headers.set("Content-Type", contentType);
    const responseBody = upstream.body && await upstream.arrayBuffer();
    return new Response(responseBody, { status: upstream.status, headers });
  } catch {
    return Response.json(
      { detail: "The configured API is unavailable." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
