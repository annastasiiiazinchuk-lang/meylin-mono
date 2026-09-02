-- AlterTable
ALTER TABLE "payments" ADD COLUMN "sitniksOrderId" BIGINT;
ALTER TABLE "payments" ADD COLUMN "sitniksOrderNumber" TEXT;
ALTER TABLE "payments" ADD COLUMN "sitniksSyncStatus" TEXT;
ALTER TABLE "payments" ADD COLUMN "sitniksSyncError" TEXT;
ALTER TABLE "payments" ADD COLUMN "sitniksSyncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "payments_sitniksOrderId_idx" ON "payments"("sitniksOrderId");
