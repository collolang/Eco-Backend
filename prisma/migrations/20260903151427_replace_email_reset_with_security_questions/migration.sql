/*
  Warnings:

  - You are about to drop the column `reset_token` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `reset_token_expiry` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "reset_token",
DROP COLUMN "reset_token_expiry",
ADD COLUMN     "hasSecurityQuestions" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "security_questions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_questions_userId_idx" ON "security_questions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "security_questions_userId_question_key" ON "security_questions"("userId", "question");

-- CreateIndex
CREATE INDEX "emission_entries_companyId_userId_year_month_idx" ON "emission_entries"("companyId", "userId", "year", "month");

-- CreateIndex
CREATE INDEX "emission_entries_companyId_userId_year_idx" ON "emission_entries"("companyId", "userId", "year");

-- CreateIndex
CREATE INDEX "emission_entries_companyId_userId_month_idx" ON "emission_entries"("companyId", "userId", "month");

-- AddForeignKey
ALTER TABLE "security_questions" ADD CONSTRAINT "security_questions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
