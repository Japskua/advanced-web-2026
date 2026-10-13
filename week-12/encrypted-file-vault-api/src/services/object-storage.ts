/**
 * Object storage for the encrypted files, through Bun's built-in S3 client.
 *
 * Week 5 wrote uploads to the server's disk. That does not scale: a
 * container's filesystem disappears when the container is rebuilt, and two
 * copies of the API would each have their own files. Object storage is a
 * separate service for files ("objects" in a "bucket", addressed by a key),
 * reachable from every copy of the API.
 *
 * "S3" is Amazon's object storage API, and it has become the standard: almost
 * every provider speaks it. The same code works with
 *   - SeaweedFS in Docker (local development, or on your own server),
 *   - Hetzner Object Storage, DigitalOcean Spaces, Cloudflare R2, Backblaze B2,
 *     AWS S3 …
 * Only the endpoint and the credentials in the environment change.
 *
 * Bun has an S3 client built in (`S3Client` from "bun"), so no SDK is needed.
 */
import { S3Client } from "bun";
import { S3_ACCESS_KEY_ID, S3_BUCKET, S3_ENDPOINT, S3_REGION, S3_SECRET_ACCESS_KEY, S3_VIRTUAL_HOSTED_STYLE } from "../config";

const storage = new S3Client({
  endpoint: S3_ENDPOINT,
  bucket: S3_BUCKET,
  region: S3_REGION,
  accessKeyId: S3_ACCESS_KEY_ID,
  secretAccessKey: S3_SECRET_ACCESS_KEY,
  // Path style (https://host/bucket/key) by default; some providers want the
  // bucket in the host name (https://bucket.host/key) instead.
  virtualHostedStyle: S3_VIRTUAL_HOSTED_STYLE,
});

// Called once at startup: fail immediately, with a clear message, if the
// bucket or the credentials are wrong, instead of on the first upload.
export async function checkStorage(): Promise<void> {
  try {
    await storage.list({ maxKeys: 1 });
  } catch (error) {
    throw new Error(`Cannot use bucket "${S3_BUCKET}" at ${S3_ENDPOINT}: ${String(error)}`, { cause: error });
  }
}

export async function putObject(key: string, data: Uint8Array): Promise<void> {
  await storage.write(key, data, { type: "application/octet-stream" });
}

export async function getObject(key: string): Promise<Uint8Array> {
  return await storage.file(key).bytes();
}

export async function deleteObject(key: string): Promise<void> {
  await storage.delete(key);
}
