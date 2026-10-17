import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default(process.env.RENDER_EXTERNAL_URL ?? "http://localhost:3000"),
  SESSION_SECRET: z.string().min(24, "SESSION_SECRET doit faire au moins 24 caractères"),
  PAYMENT_PROVIDER: z.string().default("mock"),
  PAYMENT_WEBHOOK_SECRET: z.string().min(12),
  CRON_SECRET: z.string().min(12),
  FILE_SIGNING_SECRET: z.string().min(12),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["log", "http"]).default("log"),
  EMAIL_HTTP_URL: z.string().optional(),
  EMAIL_HTTP_TOKEN: z.string().optional(),
  EMAIL_FROM: z.string().default("Talent Bridge <no-reply@talentbridge.africa>"),
  SMS_PROVIDER: z.enum(["log", "http"]).default("log"),
  SMS_HTTP_URL: z.string().optional(),
  SMS_HTTP_TOKEN: z.string().optional(),
  REDIS_URL: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Variables d'environnement validées (échec explicite au démarrage si mal configuré). */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Configuration invalide : ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(", ")}`);
  }
  cached = parsed.data;
  return cached;
}

/** Données et comptes de démonstration autorisés (jamais en production sauf démo hébergée explicite). */
export function demoAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.DEMO_SEED === "true";
}
