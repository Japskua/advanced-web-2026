import { fallback, routes } from "./router";

const APP_NAME = "Todo App Part 2";
const PORT = 8000;

const server = Bun.serve({
  port: PORT,
  // Requests that match an entry in `routes` go to that handler...
  routes,
  // ...everything else goes to `fetch`: static files and 404s.
  fetch: fallback,
});

console.log(`${APP_NAME} running at ${server.url}`);
