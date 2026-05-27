import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { DocumentHashService } from "../../domain/document-hash.service";
import type { StoredArtifact } from "../../domain/document.types";

const DEFAULT_LOCAL_ROOT = process.env.DOCUMENT_STORAGE_LOCAL_ROOT ?? "/tmp/skalway-documents";
const DEFAULT_BUCKET = process.env.DOCUMENT_STORAGE_BUCKET ?? "documents";
const DEFAULT_DRIVER = process.env.DOCUMENT_STORAGE_DRIVER ?? "local";

export class DocumentStorageService {
  private readonly driver = DEFAULT_DRIVER;
  private readonly bucket = DEFAULT_BUCKET;
  private readonly localRoot = DEFAULT_LOCAL_ROOT;
  private readonly s3 =
    this.driver === "s3"
      ? new S3Client({
          region: process.env.DOCUMENT_STORAGE_REGION ?? "us-east-1",
          endpoint: process.env.DOCUMENT_STORAGE_ENDPOINT,
          forcePathStyle: (process.env.DOCUMENT_STORAGE_FORCE_PATH_STYLE ?? "true") === "true",
          credentials:
            process.env.DOCUMENT_STORAGE_ACCESS_KEY_ID && process.env.DOCUMENT_STORAGE_SECRET_ACCESS_KEY
              ? {
                  accessKeyId: process.env.DOCUMENT_STORAGE_ACCESS_KEY_ID,
                  secretAccessKey: process.env.DOCUMENT_STORAGE_SECRET_ACCESS_KEY,
                }
              : undefined,
        })
      : null;

  async putObject(key: string, bytes: Uint8Array, contentType: string): Promise<StoredArtifact> {
    const checksumSha256 = DocumentHashService.computeBinaryHash(bytes);

    if (this.driver === "s3") {
      if (!this.s3) {
        throw new Error("S3 client indisponivel.");
      }

      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: bytes,
          ContentType: contentType,
        }),
      );

      const signedUrl = await getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn: 3600 },
      );

      return {
        bucket: this.bucket,
        key,
        url: signedUrl,
        size: bytes.byteLength,
        checksumSha256,
      };
    }

    const filePath = join(this.localRoot, key);
    await fs.mkdir(join(filePath, ".."), { recursive: true });
    await fs.writeFile(filePath, bytes);

    return {
      bucket: this.bucket,
      key,
      url: `file://${filePath}`,
      size: bytes.byteLength,
      checksumSha256,
    };
  }

  async getObjectBytes(key: string): Promise<Uint8Array> {
    if (this.driver === "s3") {
      if (!this.s3) {
        throw new Error("S3 client indisponivel.");
      }

      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      const chunks: Uint8Array[] = [];
      const body = response.Body;
      if (!body || typeof (body as any)[Symbol.asyncIterator] !== "function") {
        throw new Error("Resposta de storage sem body legivel.");
      }

      for await (const chunk of body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return this.concatChunks(chunks);
    }

    const filePath = join(this.localRoot, key);
    return new Uint8Array(await fs.readFile(filePath));
  }

  async createPdfResponse(key: string, fileName: string) {
    const bytes = await this.getObjectBytes(key);
    return new Response(new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  async getSignedObjectUrl(key: string): Promise<string | null> {
    if (this.driver !== "s3" || !this.s3) {
      return null;
    }

    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 3600 },
    );
  }

  private concatChunks(chunks: Uint8Array[]) {
    const size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const out = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  }
}
