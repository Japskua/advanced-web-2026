/**
 * The route table: every endpoint of the API on one screen, with its access
 * rule (`auth: true` = logged-in users only, see plugins/auth.ts). Each
 * handler reads the input, calls a service and responds; the rules live in
 * util/validation.ts and the services.
 */
import { Elysia } from "elysia";
import { BadRequestError, TooManyRequestsError } from "./errors";
import { toUserDto } from "./mappers";
import { auth } from "./plugins/auth";
import { loginUser, registerUser, setKeyFingerprint } from "./services/auth-service";
import { deleteFile, downloadFile, listFiles, uploadFile } from "./services/file-service";
import { clientIp } from "./util/client-ip";
import { RateLimiter } from "./util/rate-limiter";
import { ok } from "./util/response";
import {
  asObject,
  parseLoginBody,
  parseOnboardingBody,
  parseRegisterBody,
  parseUploadForm,
  parseUuid,
} from "./util/validation";

// At most 5 login attempts per IP address and email per 15 minutes (week 11);
// a successful login resets the count.
const loginLimiter = new RateLimiter(5, 15 * 60 * 1000);

export const routes = new Elysia({ prefix: "/api" })
  .use(auth)

  // Health check: Docker (see the Dockerfile's HEALTHCHECK) and load balancers
  // call this to decide whether the container is alive and may receive traffic.
  .get("/health", () => ok({ status: "up" }))

  // public
  .post("/auth/register", async ({ body, status }) => {
    return status(201, ok(await registerUser(parseRegisterBody(asObject(body)))));
  })
  .post("/auth/login", async ({ body, request, server }) => {
    const { email, password } = parseLoginBody(asObject(body));

    // Count the attempt before the slow password check, so a burst of parallel
    // guesses cannot slip past the limit (see util/rate-limiter.ts).
    const key = `${clientIp(request, server)}|${email}`;
    const limit = loginLimiter.consume(key);
    if (!limit.allowed) throw new TooManyRequestsError(limit.retryAfterSeconds);

    const result = await loginUser(email, password); // throws 401 on bad credentials
    loginLimiter.reset(key);
    return ok(result);
  })

  // logged-in users
  .get("/auth/me", ({ user }) => ok(toUserDto(user)), { auth: true })
  // Register the fingerprint of the new key.
  .post("/auth/onboarding", async ({ body, user }) => {
    const { keyFingerprint } = parseOnboardingBody(asObject(body));
    return ok(await setKeyFingerprint(user, keyFingerprint));
  }, { auth: true })

  .get("/files", async ({ user }) => ok(await listFiles(user)), { auth: true })
  // multipart/form-data with the encrypted bytes and metadata.
  .post("/files", async ({ body, headers, user, status }) => {
    if (!headers["content-type"]?.startsWith("multipart/form-data")) {
      throw new BadRequestError("Expected a multipart/form-data body.");
    }
    return status(201, ok(await uploadFile(user, parseUploadForm(asObject(body)))));
  }, { auth: true })
  .delete("/files/:id", async ({ params, user, status }) => {
    await deleteFile(user, parseUuid(params.id, "file id"));
    return status(204);
  }, { auth: true })
  // The encrypted bytes, as they are stored: only the browser can decrypt them.
  .get("/files/:id/content", async ({ params, user, set }) => {
    const encrypted = await downloadFile(user, parseUuid(params.id, "file id"));
    set.headers["content-type"] = "application/octet-stream";
    set.headers["cache-control"] = "no-store";
    return encrypted;
  }, { auth: true });
