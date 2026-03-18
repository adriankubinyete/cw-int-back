/*
  Warnings:

  - Added the required column `name` to the `Integration` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Integration_userId_erpType_key";

-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "ExecutionLog_workflowId_idx" ON "ExecutionLog"("workflowId");

-- CreateIndex
CREATE INDEX "Integration_userId_idx" ON "Integration"("userId");

-- CreateIndex
CREATE INDEX "Integration_userId_erpType_idx" ON "Integration"("userId", "erpType");

-- CreateIndex
CREATE INDEX "Workflow_userId_idx" ON "Workflow"("userId");
