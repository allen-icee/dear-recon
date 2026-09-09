/*
  Warnings:

  - A unique constraint covering the columns `[shop,orderId,lineItemId]` on the table `ReconciliationException` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationException_shop_orderId_lineItemId_key" ON "ReconciliationException"("shop", "orderId", "lineItemId");
