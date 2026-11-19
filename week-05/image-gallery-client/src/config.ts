// Where the back-end runs. The client (port 5173) and the API (port 8000) are
// different origins, which is why the API has to send CORS headers.
//
// Hard-coded for local development. Week 12 reads it from an environment
// variable at build time, so the deployed client can point to the deployed API.
export const API_URL = "http://localhost:8000";

// The API's WebSocket endpoint: the same host and port, ws:// instead of
// http:// (wss:// instead of https:// once the site uses HTTPS).
export const WS_URL = `${API_URL.replace(/^http/, "ws")}/ws`;
