/**
 * The OpenID Connect client configuration.
 *
 * OIDC providers publish their endpoints and keys in a *discovery document* at
 * <issuer>/.well-known/openid-configuration (Google's:
 * https://accounts.google.com/.well-known/openid-configuration). openid-client
 * downloads it and configures itself: where to send the user, where to
 * exchange codes, which keys sign the ID tokens.
 *
 * Discovery happens on first use and the result is cached. If it fails (no
 * network), the next request tries again instead of the server refusing to
 * start.
 */
import * as oidc from "openid-client";
import { CLIENT_ID, CLIENT_SECRET, OIDC_ISSUER } from "../config";

let configPromise: Promise<oidc.Configuration> | null = null;

export function getOidcConfig(): Promise<oidc.Configuration> {
  if (!configPromise) {
    const issuer = new URL(OIDC_ISSUER);
    // openid-client refuses plain-HTTP providers. That is only acceptable for a
    // provider on this machine (the mock provider used in development and tests).
    const isLocal = issuer.protocol === "http:" && ["localhost", "127.0.0.1"].includes(issuer.hostname);

    configPromise = oidc
      .discovery(issuer, CLIENT_ID, CLIENT_SECRET, undefined, isLocal ? { execute: [oidc.allowInsecureRequests] } : {})
      .catch((error: unknown) => {
        configPromise = null; // try again on the next request
        throw error;
      });
  }
  return configPromise;
}
