// Where the back-end runs. The client (port 5173) and the API (port 8000) are
// different origins, which is why the API has to send CORS headers.
//
// Hard-coded for local development. Week 12 reads it from an environment
// variable at build time, so the deployed client can point to the deployed API.
export const API_URL = "http://localhost:8000";
