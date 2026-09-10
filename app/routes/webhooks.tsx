import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { runTargetedReconciliationScan } from "../services/reconciliation.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  if (!admin && topic !== "APP_UNINSTALLED") {
    // The webhook might not have an admin context if the shop has uninstalled
    return new Response();
  }

  switch (topic) {
    case "APP_UNINSTALLED": {
      console.log(`🚀 [Webhook ${topic}] Cleaning up data for uninstalled shop ${shop}`);
      try {
        if (session) {
          await db.session.deleteMany({ where: { shop } });
        }
        await db.merchantSettings.deleteMany({ where: { shop } });
        await db.shopSettings.deleteMany({ where: { shop } });
        await db.reconciliationException.deleteMany({ where: { shop } });
        console.log(`✅ [Webhook] Successfully cleaned up data for shop ${shop}`);
      } catch (error) {
        console.error(`❌ [Webhook] Error cleaning up data for shop ${shop}:`, error);
      }
      break;
    }
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
          if (!admin) {
            throw new Error(`Admin context missing for shop ${shop}`);
          }
          const result = await runTargetedReconciliationScan(admin, shop, orderIdStr);
          console.log(`✅ [Webhook] Scan complete for ${orderIdStr}:`, result);
        } catch (error) {
          console.error(`❌ [Webhook] Error scanning order ${orderIdStr} on shop ${shop}:`, error);
        }
      }
      break;
    }
    default:
      console.log(`Unhandled webhook topic: ${topic} for shop ${shop}`);
  }

  return new Response();
};
