/*
  Warnings:

  - You are about to drop the `ExecutionLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExecutionStatus" ADD VALUE 'WAITING_INPUT';
ALTER TYPE "ExecutionStatus" ADD VALUE 'TIMED_OUT';

-- DropForeignKey
ALTER TABLE "ExecutionLog" DROP CONSTRAINT "ExecutionLog_workflowId_fkey";

-- DropTable
DROP TABLE "ExecutionLog";

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "lastInteraction" TIMESTAMP(3),
    "timeoutMinutes" INTEGER NOT NULL DEFAULT 10,
    "inputPayload" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "errorMessage" TEXT,
    "contactPhone" TEXT,
    "conversationKey" TEXT,
    "resumeNodeId" TEXT,
    "waitingVariable" TEXT,
    "snapshot" JSONB,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Execution_workflowId_idx" ON "Execution"("workflowId");

-- CreateIndex
CREATE INDEX "Execution_conversationKey_status_idx" ON "Execution"("conversationKey", "status");

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
