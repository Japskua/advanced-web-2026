// Entry point: start the app from app.ts on PORT.
import { app } from "./app";
import { OIDC_ISSUER, PORT } from "./config";

app.listen(PORT);

console.log(`Profile Viewer API running at ${app.server?.url} (identity provider: ${OIDC_ISSUER})`);
