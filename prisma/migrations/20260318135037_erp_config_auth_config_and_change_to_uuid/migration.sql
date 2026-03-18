/*
  Warnings:

  - You are about to drop the column `baseUrl` on the `Integration` table. All the data in the column will be lost.
  - You are about to drop the column `credentials` on the `Integration` table. All the data in the column will be lost.
  - Added the required column `authConfig` to the `Integration` table without a default value. This is not possible if the table is not empty.

*/
-- Adiciona como nullable primeiro
ALTER TABLE "Integration" ADD COLUMN "authConfig" TEXT;
ALTER TABLE "Integration" ADD COLUMN "erpConfig" TEXT;

-- Preenche as linhas existentes com um placeholder
UPDATE "Integration" SET "authConfig" = '{}', "erpConfig" = '{}';

-- Agora torna NOT NULL
ALTER TABLE "Integration" ALTER COLUMN "authConfig" SET NOT NULL;
ALTER TABLE "Integration" ALTER COLUMN "erpConfig" SET NOT NULL;
ALTER TABLE "Integration" ALTER COLUMN "erpConfig" SET DEFAULT '{}';

-- Remove colunas antigas
ALTER TABLE "Integration" DROP COLUMN "baseUrl";
ALTER TABLE "Integration" DROP COLUMN "credentials";