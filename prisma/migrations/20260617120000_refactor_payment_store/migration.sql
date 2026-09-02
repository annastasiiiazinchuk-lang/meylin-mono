-- AlterTable
ALTER TABLE "payments" ADD COLUMN "shopifyOrderName" TEXT;
ALTER TABLE "payments" ADD COLUMN "paymentType" TEXT;
ALTER TABLE "payments" ADD COLUMN "cartTotal" DOUBLE PRECISION;
ALTER TABLE "payments" ADD COLUMN "tracking" JSONB;
ALTER TABLE "payments" ADD COLUMN "webhookPayload" JSONB;

-- CreateTable
CREATE TABLE "shopify_tokens" (
    "shop" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "scope" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_tokens_pkey" PRIMARY KEY ("shop")
);

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");
