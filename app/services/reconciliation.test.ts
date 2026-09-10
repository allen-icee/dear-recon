import { vi, describe, it, expect, beforeEach } from "vitest";
import { processOrderReconciliation } from "./reconciliation.server";
import prisma from "../db.server";

vi.mock("../db.server", () => ({
  default: {
    reconciliationException: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

describe("processOrderReconciliation", () => {
  const shop = "test-shop.myshopify.com";
  const settings = { minimumExposure: 0 };

  const createBaseOrder = () => ({
    id: "gid://shopify/Order/123",
    name: "#1001",
    lineItems: {
      edges: [
        {
          node: {
            id: "gid://shopify/LineItem/1",
            name: "Test Product",
            quantity: 1,
            originalUnitPriceSet: {
              shopMoney: { amount: "10.00", currencyCode: "USD" },
            },
            variant: {
              id: "gid://shopify/ProductVariant/1",
              sku: "TEST-SKU",
            },
          },
        },
      ],
    },
    refunds: [] as any[],
    returns: { edges: [] as any[] },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Scenario A: Full refund + no return creates an exception", async () => {
    const order = createBaseOrder();
    order.refunds = [
      {
        refundLineItems: {
          edges: [
            {
              node: {
                quantity: 1,
                restockType: "RETURN",
                lineItem: { id: "gid://shopify/LineItem/1" },
              },
            },
          ],
        },
      },
    ];

    const exceptionsCount = await processOrderReconciliation(order, shop, settings);

    expect(exceptionsCount).toBe(1);
    expect(prisma.reconciliationException.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = vi.mocked(prisma.reconciliationException.upsert).mock.calls[0][0];

    expect(upsertArgs.create.discrepancyQuantity).toBe(1);
    expect(upsertArgs.create.status).toBe("OPEN");
    expect(prisma.reconciliationException.updateMany).not.toHaveBeenCalled();
  });

  it("Scenario B: Partial refund + partial return of the exact same quantity creates no exception", async () => {
    const order = createBaseOrder();

    // Partial refund of 1
    order.refunds = [
      {
        refundLineItems: {
          edges: [
            {
              node: {
                quantity: 1,
                restockType: "RETURN",
                lineItem: { id: "gid://shopify/LineItem/1" },
              },
            },
          ],
        },
      },
    ];

    // Partial return of 1
    order.returns.edges = [
      {
        node: {
          returnLineItems: {
            edges: [
              {
                node: {
                  quantity: 1,
                  fulfillmentLineItem: {
                    lineItem: { id: "gid://shopify/LineItem/1" },
                  },
                },
              },
            ],
          },
        },
      },
    ];

    const exceptionsCount = await processOrderReconciliation(order, shop, settings);

    expect(exceptionsCount).toBe(0);
    expect(prisma.reconciliationException.upsert).not.toHaveBeenCalled();
    // It should hit the updateMany for cleanup
    expect(prisma.reconciliationException.updateMany).toHaveBeenCalledTimes(1);
  });

  it("Scenario C: Cancelled order where restockType === 'CANCEL' is ignored", async () => {
    const order = createBaseOrder();

    order.refunds = [
      {
        refundLineItems: {
          edges: [
            {
              node: {
                quantity: 1,
                restockType: "CANCEL", // Cancel restock type
                lineItem: { id: "gid://shopify/LineItem/1" },
              },
            },
          ],
        },
      },
    ];

    const exceptionsCount = await processOrderReconciliation(order, shop, settings);

    expect(exceptionsCount).toBe(0);
    expect(prisma.reconciliationException.upsert).not.toHaveBeenCalled();
    // Should hit updateMany because effective refund quantity is 0, so discrepancy is 0
    expect(prisma.reconciliationException.updateMany).toHaveBeenCalledTimes(1);
  });

  it("Scenario D: Zero Discrepancy Cleanup updates status to RESOLVED", async () => {
    const order = createBaseOrder();

    // Refund of 1, return of 1
    order.refunds = [
      {
        refundLineItems: {
          edges: [
            {
              node: {
                quantity: 1,
                restockType: "RETURN",
                lineItem: { id: "gid://shopify/LineItem/1" },
              },
            },
          ],
        },
      },
    ];

    order.returns.edges = [
      {
        node: {
          returnLineItems: {
            edges: [
              {
                node: {
                  quantity: 1,
                  fulfillmentLineItem: {
                    lineItem: { id: "gid://shopify/LineItem/1" },
                  },
                },
              },
            ],
          },
        },
      },
    ];

    const exceptionsCount = await processOrderReconciliation(order, shop, settings);

    expect(exceptionsCount).toBe(0);

    expect(prisma.reconciliationException.updateMany).toHaveBeenCalledTimes(1);
    const updateArgs = vi.mocked(prisma.reconciliationException.updateMany).mock.calls[0][0];

    // Check that it targets OPEN items and sets them to RESOLVED
    expect(updateArgs.where!.status).toBe("OPEN");
    expect(updateArgs.data.status).toBe("RESOLVED");
    expect(updateArgs.data.discrepancyQuantity).toBe(0);
  });
});
