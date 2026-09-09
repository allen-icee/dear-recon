import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { Money } from "../utils/finance.server";
import prisma from "../db.server";

export const RECONCILIATION_QUERY = `
  query GetReconciliationData($query: String!) {
    orders(first: 15, query: $query, sortKey: UPDATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          createdAt
          updatedAt
          lineItems(first: 25) {
            edges {
              node {
                id
                name
                quantity
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

/**
 * Fetches recent orders with refunds, returns, and inventory costs,
 * compares the line item quantities, and upserts discrepancies to Prisma.
 */
export async function runReconciliationScan(admin: AdminApiContext, shop: string, query: string = "updated_at:>=last_week") {
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
    const lineItems = order.lineItems.edges.map((e: any) => e.node);
    
    // Aggregate refunds per lineItem
    const refundMap = new Map<string, number>();
    for (const refund of order.refunds) {
      for (const refundLineItemEdge of refund.refundLineItems.edges) {
        const rl = refundLineItemEdge.node;
        if (rl.lineItem?.id) {
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
        const unitCostAmount = variant?.inventoryItem?.unitCost?.amount || "0";
        const currencyCode = variant?.inventoryItem?.unitCost?.currencyCode || "USD";

        // Decimal-safe math utilizing the utility class
        const exposure = new Money(unitCostAmount, currencyCode).multiply(discrepancyQuantity);

        const existing = await prisma.reconciliationException.findFirst({
          where: { shop, orderId: order.id, lineItemId: lineItem.id }
        });

        const recordData = {
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
          status: "OPEN" // Always force open if a discrepancy is still actively detected on scan
        };

        if (existing) {
          await prisma.reconciliationException.update({
            where: { id: existing.id },
            data: recordData
          });
        } else {
          await prisma.reconciliationException.create({ data: recordData });
        }
        exceptionsCount++;
      }
    }
  }

  return { scannedOrders: orders.length, exceptionsCount };
}
