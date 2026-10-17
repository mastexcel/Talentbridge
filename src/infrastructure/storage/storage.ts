/**
 * Stockage objet. Deux pilotes derrière la même interface :
 *  - local : disque (développement, tests) ;
 *  - s3    : tout service compatible S3 (production), via URL pré-signées.
 * Les fichiers privés ne sont JAMAIS servis directement : la route /api/v1/files/[id]
 * contrôle l'autorisation, puis sert le fichier ou redirige vers une URL signée de 5 minutes.
 */
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { env } from "../env";
import { presignUrl, type S3Config } from "./s3-sign";

export interface ObjectStorage {
  readonly driver: "local" | "s3";
  put(key: string, bytes: Uint8Array, mimeType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  /** URL directe temporaire (S3) ; null pour le stockage local (servi par l'application). */
  temporaryUrl(key: string, expiresSec?: number): string | null;
}

class LocalStorage implements ObjectStorage {
  readonly driver = "local" as const;
  constructor(private readonly root: string) {}
  private resolve(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(path.resolve(this.root))) throw new Error("Clé de stockage invalide.");
    return p;
  }
  async put(key: string, bytes: Uint8Array) {
    const p = this.resolve(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, bytes);
  }
  async get(key: string) {
    return new Uint8Array(await readFile(this.resolve(key)));
  }
  async delete(key: string) {
    await unlink(this.resolve(key)).catch(() => undefined);
  }
  temporaryUrl() {
    return null;
  }
}

class S3Storage implements ObjectStorage {
  readonly driver = "s3" as const;
  constructor(private readonly cfg: S3Config) {}
  async put(key: string, bytes: Uint8Array, mimeType: string) {
    const res = await fetch(presignUrl(this.cfg, "PUT", key, 300), { method: "PUT", body: Buffer.from(bytes), headers: { "content-type": mimeType } });
    if (!res.ok) throw new Error(`Échec d'envoi vers le stockage S3 (${res.status}).`);
  }
  async get(key: string) {
    const res = await fetch(presignUrl(this.cfg, "GET", key, 300));
    if (!res.ok) throw new Error(`Fichier introuvable dans le stockage S3 (${res.status}).`);
    return new Uint8Array(await res.arrayBuffer());
  }
  async delete(key: string) {
    // Suppression différée : le cycle de vie du bucket (lifecycle policy) purge les objets orphelins.
    void key;
  }
  temporaryUrl(key: string, expiresSec = 300) {
    return presignUrl(this.cfg, "GET", key, expiresSec);
  }
}

let instance: ObjectStorage | null = null;

export function storage(): ObjectStorage {
  if (instance) return instance;
  const e = env();
  if (e.STORAGE_DRIVER === "s3") {
    if (!e.S3_ENDPOINT || !e.S3_BUCKET || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY) {
      throw new Error("STORAGE_DRIVER=s3 exige S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID et S3_SECRET_ACCESS_KEY.");
    }
    instance = new S3Storage({ endpoint: e.S3_ENDPOINT, region: e.S3_REGION, bucket: e.S3_BUCKET, accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY });
  } else {
    instance = new LocalStorage(e.STORAGE_LOCAL_DIR);
  }
  return instance;
}
