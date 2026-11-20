import { relayOpsRequest } from "../relay";

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return Response.json(
      { detail: "Content-Type must be application/json." },
      { status: 415, headers: { "Cache-Control": "no-store" } },
    );
  }

  return relayOpsRequest("chat", request.signal, await request.arrayBuffer());
}
