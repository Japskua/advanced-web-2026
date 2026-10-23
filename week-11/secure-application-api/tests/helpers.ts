// Shared test helpers: start one version of the app and talk to it.
import type { AnyElysia } from "elysia";

export interface TestApp {
  url: string;
  stop: () => void;
}

// Start an app on a free port. app.listen (not app.handle) so that the app has
// its own server and can read the client's IP address (the login rate limit).
export function startApp(app: AnyElysia): TestApp {
  app.listen(0);
  if (!app.server) throw new Error("the app did not start");
  return { url: app.server.url.origin, stop: () => void app.stop(true) };
}

export interface Reply {
  status: number;
  headers: Headers;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the two versions answer in different shapes
  body: any;
}

export async function call(
  baseUrl: string,
  method: string,
  path: string,
  options: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<Reply> {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

export async function login(baseUrl: string, email: string, password: string): Promise<string> {
  const reply = await call(baseUrl, "POST", "/api/login", { body: { email, password } });
  if (reply.status !== 200) throw new Error(`login failed for ${email}: ${reply.status}`);
  return reply.body.data.token as string;
}
