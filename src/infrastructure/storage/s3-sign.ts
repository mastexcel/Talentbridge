/**
 * Signature AWS SigV4 minimale (compatible S3, MinIO, Scaleway, OVH, Cloudflare R2…),
 * sans dépendance au SDK : URL pré-signées (GET/PUT) à durée limitée.
 */
import { createHash, createHmac } from "node:crypto";

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const sha256hex = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const hmac = (k: Buffer | string, s: string) => createHmac("sha256", k).update(s).digest();

export interface S3Config {
  endpoint: string; // https://s3.eu-west-3.amazonaws.com ou https://minio.local:9000
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function amzDate(d: Date): { full: string; short: string } {
  const full = d.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { full, short: full.slice(0, 8) };
}

/** URL pré-signée (style « path » : endpoint/bucket/key). */
export function presignUrl(cfg: S3Config, method: "GET" | "PUT", key: string, expiresSec: number, now = new Date()): string {
  const url = new URL(cfg.endpoint);
  const host = url.host;
  const path = `/${cfg.bucket}/${key.split("/").map(enc).join("/")}`;
  const { full, short } = amzDate(now);
  const scope = `${short}/${cfg.region}/s3/aws4_request`;
  const params: [string, string][] = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${cfg.accessKeyId}/${scope}`],
    ["X-Amz-Date", full],
    ["X-Amz-Expires", String(expiresSec)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const query = params.map(([k, v]) => `${enc(k)}=${enc(v)}`).sort().join("&");
  const canonical = [method, path, query, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", full, scope, sha256hex(canonical)].join("\n");
  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, short);
  const kSigning = hmac(hmac(hmac(kDate, cfg.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", kSigning).update(toSign).digest("hex");
  return `${url.protocol}//${host}${path}?${query}&X-Amz-Signature=${signature}`;
}

/** Variante « virtual-hosted » utilisée par la documentation AWS (tests de conformité). */
export function presignVirtualHosted(cfg: Omit<S3Config, "endpoint">, key: string, expiresSec: number, now: Date): string {
  const host = `${cfg.bucket}.s3.amazonaws.com`;
  const path = `/${key.split("/").map(enc).join("/")}`;
  const { full, short } = amzDate(now);
  const scope = `${short}/${cfg.region}/s3/aws4_request`;
  const params: [string, string][] = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${cfg.accessKeyId}/${scope}`],
    ["X-Amz-Date", full],
    ["X-Amz-Expires", String(expiresSec)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const query = params.map(([k, v]) => `${enc(k)}=${enc(v)}`).sort().join("&");
  const canonical = ["GET", path, query, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", full, scope, sha256hex(canonical)].join("\n");
  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, short);
  const kSigning = hmac(hmac(hmac(kDate, cfg.region), "s3"), "aws4_request");
  return createHmac("sha256", kSigning).update(toSign).digest("hex");
}
