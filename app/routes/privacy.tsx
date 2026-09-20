import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy | DearRecon" },
    { name: "description", content: "Privacy Policy for DearRecon Shopify App" },
  ];
};

export default function PrivacyPolicy() {
  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", lineHeight: "1.6", maxWidth: "800px", margin: "0 auto", padding: "2rem", color: "#202223" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1.5rem" }}>Privacy Policy for DearRecon</h1>

      <h2 style={{ fontSize: "1.5rem", marginTop: "2rem", marginBottom: "1rem" }}>Data Collection & Usage</h2>
      <p>DearRecon is designed to seamlessly help merchants reconcile refunds and returns. To provide this operational service, we only access and process data strictly related to Orders, Refunds, and Inventory Levels. Specifically, we only process:</p>
      <ul>
        <li>Order IDs</li>
        <li>SKU quantities</li>
        <li>Financial discrepancy amounts</li>
      </ul>

      <h2 style={{ fontSize: "1.5rem", marginTop: "2rem", marginBottom: "1rem" }}>Zero PII Policy (Personally Identifiable Information)</h2>
      <p style={{ color: "#D82C0D", fontWeight: "bold" }}>We take your customers' privacy seriously. DearRecon does NOT collect, store, or process any Personally Identifiable Information (PII).</p>
      <p>This means our application has zero visibility into your customers' sensitive data, including but not limited to:</p>
      <ul>
        <li>Customer names</li>
        <li>Email addresses</li>
        <li>Phone numbers</li>
        <li>Physical shipping or billing addresses</li>
        <li>Payment credentials or credit card information</li>
      </ul>

      <h2 style={{ fontSize: "1.5rem", marginTop: "2rem", marginBottom: "1rem" }}>Data Retention & Erasure</h2>
      <p>We strictly comply with Shopify's GDPR and CCPA data privacy requirements. DearRecon fully implements Shopify's mandatory privacy webhooks.</p>
      <p>Upon uninstallation of the DearRecon app from your Shopify Admin, we receive an automated payload from Shopify to instantly erase and purge all associated store data from our servers. You remain in complete control of your data lifecycle.</p>

      <h2 style={{ fontSize: "1.5rem", marginTop: "2rem", marginBottom: "1rem" }}>Third Parties & Data Sharing</h2>
      <p>Your store data is processed securely for the sole operational purpose of inventory and refund reconciliation. <strong>We do not sell, rent, or share your data with any external third parties, advertisers, or data brokers.</strong></p>

      <h2 style={{ fontSize: "1.5rem", marginTop: "2rem", marginBottom: "1rem" }}>Contact Us</h2>
      <p>If you have any questions, concerns, or requests regarding this Privacy Policy or how your data is handled, please contact our privacy compliance team at:</p>
      <a href="mailto:support.dearrecon@gmail.com" style={{ color: "#005BD3" }}>support.dearrecon@gmail.com</a>
    </div>
  );
}