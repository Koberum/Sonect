const KEY = "sonect.sessionId";

export function getClientSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function sessionHeaders(): Record<string, string> {
  return { "X-Session-Id": getClientSessionId() };
}
