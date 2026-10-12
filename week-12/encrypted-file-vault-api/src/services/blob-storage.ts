/**
 * Azure Blob Storage: object storage for the encrypted files.
 *
 * Week 5 wrote uploads to the server's disk. In the cloud that breaks down: a
 * container's disk disappears when the container is replaced, and several
 * replicas of the API would each have their own disk. Object storage is a
 * separate, durable service that every replica can reach. Files are "blobs"
 * in a "container" (a bucket), addressed by name.
 *
 * Locally, Azurite (from docker-compose.yml) emulates the same API; the
 * connection string "UseDevelopmentStorage=true" points the SDK at it.
 *
 * Bun also has a built-in S3 client (Bun.s3) for AWS S3, Cloudflare R2, MinIO
 * and other S3-compatible stores. Azure Blob Storage speaks a different
 * protocol, so we use Microsoft's SDK, which runs on Bun unchanged.
 */
import { BlobServiceClient } from "@azure/storage-blob";
import { AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_CONTAINER_NAME } from "../config";

const container = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING).getContainerClient(
  AZURE_STORAGE_CONTAINER_NAME,
);

// Called once at startup (not on every upload, as last year's version did).
export async function ensureContainer(): Promise<void> {
  await container.createIfNotExists(); // private by default: no anonymous access
}

export async function uploadBlob(name: string, data: Uint8Array): Promise<void> {
  await container.getBlockBlobClient(name).uploadData(data, {
    blobHTTPHeaders: { blobContentType: "application/octet-stream" },
  });
}

export async function downloadBlob(name: string): Promise<Uint8Array> {
  const buffer = await container.getBlockBlobClient(name).downloadToBuffer();
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

export async function deleteBlob(name: string): Promise<void> {
  await container.getBlockBlobClient(name).deleteIfExists();
}
