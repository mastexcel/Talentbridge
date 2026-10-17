import { config } from "dotenv";

config({ quiet: true });
// Les tests utilisent toujours la base dédiée (jamais la base de développement).
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
Object.assign(process.env, { NODE_ENV: "test" });
process.env.SESSION_SECRET ??= "test-session-secret-0123456789abcdef";
process.env.PAYMENT_WEBHOOK_SECRET ??= "test-webhook-secret";
process.env.CRON_SECRET ??= "test-cron-secret";
process.env.FILE_SIGNING_SECRET ??= "test-file-signing-secret";
process.env.STORAGE_LOCAL_DIR = "./storage-test";
