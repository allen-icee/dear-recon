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

  it("Scenario A: Full refund with NO return (Expect: Exception created)", async () => {
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

  it("Scenario B: Partial refund where the returned item quantity perfectly matches the refund (Expect: No exception)", async () => {
    const order = createBaseOrder();
    
    // Partially refunded 1 item
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

    // Partially returned 1 item (perfect match)
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
  });

  it("Scenario C: Zero-Discrepancy Cleanup (Expect: A previously open exception resolves automatically)", async () => {
    const order = createBaseOrder();

    // Refunded 1 item
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

    // Returned 1 item (resolving the previous discrepancy)
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

    // Expecting to update OPEN exceptions to RESOLVED
    expect(updateArgs.where!.status).toBe("OPEN");
    expect(updateArgs.data.status).toBe("RESOLVED");
    expect(updateArgs.data.discrepancyQuantity).toBe(0);
    expect(updateArgs.data.resolutionReason).toContain("Auto-resolved");
  });
});
