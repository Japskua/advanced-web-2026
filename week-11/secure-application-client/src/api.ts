/**
 * A deliberately thin API client: it shows exactly what the server answered
 * (status code and raw JSON), because seeing the responses is the point of
 * this demo. A real client would hide most of this from the user.
 */

export const TARGETS = {
  vulnerable: { label: "Vulnerable API", url: "http://localhost:8000" },
  secure: { label: "Secure API", url: "http://localhost:8001" },
} as const;

export type Target = keyof typeof TARGETS;

export interface ApiCall {
  request: string; // e.g. "POST /api/login"
  status: number; // 0 = no response (server down, or blocked by CORS)
  body: unknown;
}

export async function callApi(
  target: Target,
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<ApiCall> {
  const request = `${method} ${path}`;
  try {
    const res = await fetch(TARGETS[target].url + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // not JSON: show the text as it is
    }
    return { request, status: res.status, body };
  } catch {
    return { request, status: 0, body: "No response: is this API running, and does its CORS policy allow this page?" };
  }
}
