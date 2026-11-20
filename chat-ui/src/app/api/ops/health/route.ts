import { relayOpsRequest } from "../relay";

export function GET(request: Request): Promise<Response> {
  return relayOpsRequest("health", request.signal);
}
