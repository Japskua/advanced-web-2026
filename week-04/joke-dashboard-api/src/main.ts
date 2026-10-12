import { fallback, routes } from "./router";

const PORT = 8000;

const server = Bun.serve({
  port: PORT,
  routes,
  fetch: fallback,
});

console.log(`Joke Dashboard API running at ${server.url}`);
