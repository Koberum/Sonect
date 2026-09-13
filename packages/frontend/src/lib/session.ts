const KEY = "sonect.sessionId";

export function getClientSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function sessionHeaders(): Record<string, string> {
  return { "X-Session-Id": getClientSessionId() };
}
