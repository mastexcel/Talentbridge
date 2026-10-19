-- CreateEnum
CREATE TYPE "CourseKind" AS ENUM ('TRAINING', 'SEMINAR');

-- CreateEnum
CREATE TYPE "CourseFormat" AS ENUM ('ONLINE', 'VIRTUAL_CLASS', 'IN_PERSON', 'BLENDED');

-- CreateEnum
CREATE TYPE "SessionMode" AS ENUM ('VIRTUAL', 'IN_PERSON');

-- DropIndex
DROP INDEX "courses_status_idx";

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "audience" TEXT,
ADD COLUMN     "domainId" TEXT,
ADD COLUMN     "format" "CourseFormat" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "kind" "CourseKind" NOT NULL DEFAULT 'TRAINING',
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'fr';

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "attendedAt" TIMESTAMP(3),
ADD COLUMN     "sessionId" TEXT;

-- AlterTable
ALTER TABLE "live_sessions" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "countryCode" CHAR(2),
ADD COLUMN     "mode" "SessionMode" NOT NULL DEFAULT 'VIRTUAL',
ADD COLUMN     "venue" TEXT;

-- CreateIndex
CREATE INDEX "courses_status_kind_idx" ON "courses"("status", "kind");

-- CreateIndex
CREATE INDEX "courses_domainId_idx" ON "courses"("domainId");

-- CreateIndex
CREATE INDEX "enrollments_sessionId_idx" ON "enrollments"("sessionId");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "expertise_domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "countries"("code") ON DELETE SET NULL ON UPDATE CASCADE;
