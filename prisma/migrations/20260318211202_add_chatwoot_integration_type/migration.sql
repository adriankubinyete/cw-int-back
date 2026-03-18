/*
  Warnings:

  - You are about to drop the column `erpType` on the `Integration` table. All the data in the column will be lost.
  - Added the required column `integrationType` to the `Integration` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('IXCSOFT', 'SGP', 'HUBSOFT', 'CHATWOOT');

-- DropIndex
DROP INDEX "Integration_userId_erpType_idx";

-- AlterTable — migra os dados ANTES de dropar a coluna antiga
ALTER TABLE "Integration" ADD COLUMN "integrationType" "IntegrationType";
UPDATE "Integration" SET "integrationType" = "erpType"::"text"::"IntegrationType";
ALTER TABLE "Integration" ALTER COLUMN "integrationType" SET NOT NULL;
ALTER TABLE "Integration" DROP COLUMN "erpType";

-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN "chatwootIntegrationId" TEXT;

-- DropEnum
DROP TYPE "ErpType";

-- CreateIndex
CREATE INDEX "Integration_userId_integrationType_idx" ON "Integration"("userId", "integrationType");
CREATE INDEX "Workflow_chatwootIntegrationId_idx" ON "Workflow"("chatwootIntegrationId");

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_chatwootIntegrationId_fkey" FOREIGN KEY ("chatwootIntegrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;