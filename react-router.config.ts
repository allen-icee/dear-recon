import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "app",
  // Allow Shopify App Bridge cross-origin requests to POST to our actions
  allowedActionOrigins: [
    "shopify.com",
    "*.shopify.com",
    "admin.shopify.com",
    "*.myshopify.com",
    "*.spin.dev",
    "*.trycloudflare.com",
    "*.onrender.com",
    "null"
  ],
} satisfies Config;
