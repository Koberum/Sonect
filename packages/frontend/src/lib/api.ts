export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API error ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export class NetworkError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "NetworkError";
  }
}

function getBaseUrl(): string {
  return import.meta.env.VITE_BACKEND_URL ?? "";
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): string {
  const base = getBaseUrl();
  const url = `${base}${path}`;
  if (!params) return url;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.append(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${url}?${qs}` : url;
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { params, body, headers, signal, ...rest } = options;
  const url = buildUrl(path, params);

  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  // Allow caller to delete default header by passing Content-Type: undefined
  if (headers && "Content-Type" in (headers as Record<string, unknown>)) {
    const ct = (headers as Record<string, string | undefined>)["Content-Type"];
    if (ct === undefined) delete finalHeaders["Content-Type"];
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      signal,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new NetworkError(
      `Network request failed: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Failed to parse JSON response from ${path}`);
    }
  }

  if (!res.ok) {
    const msg =
      data &&
      typeof data === "object" &&
      "error" in (data as Record<string, unknown>)
        ? String((data as Record<string, unknown>).error)
        : `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, data, `API ${res.status} ${path}: ${msg}`);
  }

  return data as T;
}
