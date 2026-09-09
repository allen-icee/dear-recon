import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { runTargetedReconciliationScan } from "../services/reconciliation.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    // The webhook might not have an admin context if the shop has uninstalled
    return new Response();
  }

  switch (topic) {
    case "ORDERS_UPDATED":
    case "REFUNDS_CREATE": {
      let orderIdStr = "";
      
      if (topic === "ORDERS_UPDATED") {
        // Payload is the Order object
        orderIdStr = payload.admin_graphql_api_id as string;
      } else if (topic === "REFUNDS_CREATE") {
        // Payload is the Refund object which has an order_id
        orderIdStr = `gid://shopify/Order/${payload.order_id}`;
      }

      if (orderIdStr) {
        console.log(`🚀 [Webhook ${topic}] Triggering targeted scan for ${orderIdStr} on shop ${shop}`);
        try {
          const result = await runTargetedReconciliationScan(admin, shop, orderIdStr);
          console.log(`✅ [Webhook] Scan complete:`, result);
        } catch (error) {
          console.error(`❌ [Webhook] Error scanning order ${orderIdStr}:`, error);
        }
      }
      break;
    }
    default:
      console.log(`Unhandled webhook topic: ${topic}`);
  }

  return new Response();
};
