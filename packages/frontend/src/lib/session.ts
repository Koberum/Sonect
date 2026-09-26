import { getProfileSessionId } from "./selectedProfile";

/** @deprecated Use getProfileSessionId from selectedProfile instead */
export function getClientSessionId(): string {
  return getProfileSessionId();
}

/** @deprecated Use profileSessionHeaders from selectedProfile instead */
export function sessionHeaders(): Record<string, string> {
  const id = getClientSessionId();
  return id ? { "X-Session-Id": id } : {};
}
