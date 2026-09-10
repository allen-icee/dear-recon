import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { Money } from "../utils/finance.server";
import prisma from "../db.server";

export const TARGETED_RECONCILIATION_QUERY = `
  query GetSingleOrderReconciliationData($id: ID!) {
    order(id: $id) {
      id
      name
      createdAt
      updatedAt
      cancelledAt
      lineItems(first: 25) {
        edges {
          node {
            id
            name
            quantity
            originalUnitPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            variant {
              id
              sku
              inventoryItem {
                id
                unitCost {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
      refunds(first: 10) {
        id
        createdAt
        refundLineItems(first: 10) {
          edges {
            node {
              id
              quantity
              restockType
              lineItem {
                id
              }
            }
          }
        }
      }
      returns(first: 10) {
        edges {
          node {
            id
            status
            returnLineItems(first: 10) {
              edges {
                node {
                  ... on ReturnLineItem {
                    quantity
                    fulfillmentLineItem {
                      lineItem {
                        id
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const RECONCILIATION_QUERY = `
  query GetReconciliationData($query: String!) {
    orders(first: 15, query: $query, sortKey: UPDATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          createdAt
          updatedAt
          cancelledAt
          lineItems(first: 25) {
            edges {
              node {
                id
                name
                quantity
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                variant {
                  id
                  sku
                  inventoryItem {
                    id
                    unitCost {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
          refunds(first: 10) {
            id
            createdAt
            refundLineItems(first: 10) {
              edges {
                node {
                  id
                  quantity
                  restockType
                  lineItem {
                    id
                  }
                }
              }
            }
          }
          returns(first: 10) {
            edges {
              node {
                id
                status
                returnLineItems(first: 10) {
                  edges {
                    node {
                      ... on ReturnLineItem {
                        quantity
                        fulfillmentLineItem {
                          lineItem {
                            id
                            name
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function processOrderReconciliation(order: any, shop: string, settings: { minimumExposure: number }) {
  let exceptionsCount = 0;
  const lineItems = order.lineItems.edges.map((e: any) => e.node);
  
  // Aggregate refunds per lineItem
  const refundMap = new Map<string, number>();
  for (const refund of order.refunds) {
    for (const refundLineItemEdge of refund.refundLineItems.edges) {
      const rl = refundLineItemEdge.node;
      // Ignore CANCEL restock types, as they represent unfulfilled items 
      // that were cancelled, not shipped items that were refunded.
      if (rl.lineItem?.id && rl.restockType !== "CANCEL") {
        refundMap.set(rl.lineItem.id, (refundMap.get(rl.lineItem.id) || 0) + rl.quantity);
      }
    }
  }

  // Aggregate returns per lineItem
  const returnMap = new Map<string, number>();
  for (const returnEdge of order.returns.edges) {
    for (const returnLineItemEdge of returnEdge.node.returnLineItems.edges) {
      const rli = returnLineItemEdge.node;
      if (rli.fulfillmentLineItem?.lineItem?.id) {
        const liId = rli.fulfillmentLineItem.lineItem.id;
        returnMap.set(liId, (returnMap.get(liId) || 0) + rli.quantity);
      }
    }
  }

  // Compare and generate exceptions
  for (const lineItem of lineItems) {
    const refundQuantity = refundMap.get(lineItem.id) || 0;
    const returnQuantity = returnMap.get(lineItem.id) || 0;
    const discrepancyQuantity = refundQuantity - returnQuantity;

    if (discrepancyQuantity > 0) {
      const variant = lineItem.variant;
      const priceAmount = lineItem.originalUnitPriceSet?.shopMoney?.amount || "0";
      const currencyCode = lineItem.originalUnitPriceSet?.shopMoney?.currencyCode || "USD";

      // Decimal-safe math utilizing the utility class
      const exposure = new Money(priceAmount, currencyCode).multiply(discrepancyQuantity);

      if (exposure.toNumber() >= settings.minimumExposure) {
        await prisma.reconciliationException.upsert({
        where: {
          shop_orderId_lineItemId: {
            shop,
            orderId: order.id,
            lineItemId: lineItem.id
          }
        },
        update: {
          refundQuantity,
          returnQuantity,
          discrepancyQuantity,
          estimatedExposure: exposure.toDecimal(),
        },
        create: {
          shop,
          orderId: order.id,
          orderName: order.name,
          lineItemId: lineItem.id,
          variantId: variant?.id || "",
          sku: variant?.sku || "",
          refundQuantity,
          returnQuantity,
          discrepancyQuantity,
          estimatedExposure: exposure.toDecimal(),
          currencyCode,
          status: "OPEN"
        }
      });
      exceptionsCount++;
      }
    } else if (discrepancyQuantity <= 0) {
      // Zero Discrepancy Cleanup: Auto-resolve if quantities now match 
      // (e.g. physical return finally processed)
      await prisma.reconciliationException.updateMany({
        where: { 
          shop, 
          orderId: order.id, 
          lineItemId: lineItem.id,
          status: "OPEN"
        },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolutionReason: "Auto-resolved (Quantities matched)",
          resolvedBy: "System",
          refundQuantity,
          returnQuantity,
          discrepancyQuantity,
          estimatedExposure: 0,
        }
      });
    }
  }
  
  return exceptionsCount;
}

/**
 * Fetches recent orders with refunds, returns, and inventory costs,
 * compares the line item quantities, and upserts discrepancies to Prisma.
 */
export async function runReconciliationScan(admin: AdminApiContext, shop: string, query?: string) {
  const dbSettings = await prisma.shopSettings.findUnique({ where: { shop } });
  const settings = {
    minimumExposure: dbSettings?.minimumExposure?.toNumber() || 0,
    lookbackDays: dbSettings?.lookbackDays || 30,
  };

  if (!query) {
    const lookbackDate = new Date(Date.now() - settings.lookbackDays * 24 * 60 * 60 * 1000);
    query = `updated_at:>=${lookbackDate.toISOString()}`;
  }

  const response = await admin.graphql(RECONCILIATION_QUERY, {
    variables: { query },
  });

  const data = (await response.json()) as { data: any; errors?: any[] };

  if (data.errors) {
    throw new Error(`GraphQL Errors: ${JSON.stringify(data.errors)}`);
  }

  const orders = data.data.orders.edges.map((e: any) => e.node);
  let exceptionsCount = 0;

  for (const order of orders) {
    exceptionsCount += await processOrderReconciliation(order, shop, settings);
  }

  return { scannedOrders: orders.length, exceptionsCount };
}

/**
 * Fetches a single order by ID and processes it for discrepancies.
 */
export async function runTargetedReconciliationScan(admin: AdminApiContext, shop: string, orderId: string) {
  const dbSettings = await prisma.shopSettings.findUnique({ where: { shop } });
  const settings = {
    minimumExposure: dbSettings?.minimumExposure?.toNumber() || 0,
  };

  const response = await admin.graphql(TARGETED_RECONCILIATION_QUERY, {
    variables: { id: orderId },
  });

  const data = (await response.json()) as { data: any; errors?: any[] };

  if (data.errors) {
    throw new Error(`GraphQL Errors: ${JSON.stringify(data.errors)}`);
  }

  const order = data.data.order;
  if (!order) {
    return { scannedOrders: 0, exceptionsCount: 0 };
  }

  const exceptionsCount = await processOrderReconciliation(order, shop, settings);

  return { scannedOrders: 1, exceptionsCount };
}
