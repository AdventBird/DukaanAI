-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "targetStockLevel" DECIMAL(12,3) DEFAULT 0;

-- AlterTable
ALTER TABLE "SupplierProduct" ADD COLUMN     "leadTimeDays" INTEGER;

-- CreateTable
CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "inputSummary" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "steps" JSONB NOT NULL,
    "checkpoint" JSONB NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRunAt" TIMESTAMP(3),
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentTask_storeId_status_createdAt_idx" ON "AgentTask"("storeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentTask_storeId_relatedEntityType_relatedEntityId_idx" ON "AgentTask"("storeId", "relatedEntityType", "relatedEntityId");

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
