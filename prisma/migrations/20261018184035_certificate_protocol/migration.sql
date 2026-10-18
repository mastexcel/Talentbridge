-- CreateEnum
CREATE TYPE "IssuerStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VALIDATED', 'REJECTED');

-- AlterEnum
ALTER TYPE "AdminPermission" ADD VALUE 'ACADEMY_MANAGE';

-- DropIndex
DROP INDEX "expert_profiles_headline_trgm";

-- DropIndex
DROP INDEX "missions_title_trgm";

-- DropIndex
DROP INDEX "tenders_title_trgm";

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "issuerId" TEXT,
ADD COLUMN     "tbSignatoryId" TEXT;

-- AlterTable
ALTER TABLE "learning_certificates" ADD COLUMN     "snapshot" JSONB;

-- CreateTable
CREATE TABLE "certificate_issuers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "logoFileId" TEXT,
    "sealFileId" TEXT,
    "signatoryName" TEXT,
    "signatoryTitle" TEXT,
    "signatureFileId" TEXT,
    "authorizationAttested" BOOLEAN NOT NULL DEFAULT false,
    "attestedAt" TIMESTAMP(3),
    "status" "IssuerStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_issuers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_signatories" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "signatureFileId" TEXT NOT NULL,
    "sealFileId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "forVerification" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_signatories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_certificates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "photoFileId" TEXT,
    "domains" TEXT[],
    "checks" TEXT[],
    "yearsExperience" INTEGER,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "snapshot" JSONB NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "expert_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "certificate_issuers_status_idx" ON "certificate_issuers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "expert_certificates_code_key" ON "expert_certificates"("code");

-- CreateIndex
CREATE INDEX "expert_certificates_expertId_idx" ON "expert_certificates"("expertId");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "certificate_issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_tbSignatoryId_fkey" FOREIGN KEY ("tbSignatoryId") REFERENCES "tb_signatories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_issuers" ADD CONSTRAINT "certificate_issuers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_certificates" ADD CONSTRAINT "expert_certificates_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "expert_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Numérotation continue des certificats « Consultant vérifié » (TB-CV-AAAA-NNNNNN)
CREATE SEQUENCE IF NOT EXISTS "expert_certificate_seq" START 1;
