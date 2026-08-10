type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

interface ApiClientOptions {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
}

interface RequestOptions {
  headers?: Record<string, string>;
  body?: unknown;
  queryParams?: Record<string, string | number | boolean>;
  signal?: AbortSignal;
}

export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.defaultHeaders = options.defaultHeaders || {
      "Content-Type": "application/json",
    };
  }

  private buildUrl(
    path: string,
    queryParams?: Record<string, string | number | boolean>,
  ) {
    let url = `${this.baseUrl}${path}`;
    if (queryParams) {
      const query = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null)
          query.append(key, String(value));
      });
      url += `?${query.toString()}`;
    }
    return url;
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = this.buildUrl(path, options.queryParams);
    const headers = { ...this.defaultHeaders, ...(options.headers || {}) };

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
      });
    } catch (err) {
      throw new NetworkError(
        `Network request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const text = await response.text();

    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (err) {
      throw new Error(`Failed to parse JSON response: ${err}`);
    }

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(data)}`,
      );
    }

    return data;
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.request<T>("GET", path, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>("POST", path, { ...options, body });
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>("PATCH", path, { ...options, body });
  }

  delete<T>(path: string, options?: RequestOptions) {
    return this.request<T>("DELETE", path, options);
  }
}
