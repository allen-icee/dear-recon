import { Page, Layout, Card, Text, BlockStack, List, Link } from "@shopify/polaris";
import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy | DearRecon" },
    { name: "description", content: "Privacy Policy for DearRecon Shopify App" },
  ];
};

export default function PrivacyPolicy() {
  return (
    <Page title="Privacy Policy for DearRecon">
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card padding="600">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Data Collection & Usage</Text>
                <Text as="p">
                  DearRecon is designed to seamlessly help merchants reconcile refunds and returns. To provide this operational service, we only access and process data strictly related to Orders, Refunds, and Inventory Levels. Specifically, we only process:
                </Text>
                <List>
                  <List.Item>Order IDs</List.Item>
                  <List.Item>SKU quantities</List.Item>
                  <List.Item>Financial discrepancy amounts</List.Item>
                </List>
              </BlockStack>
            </Card>

            <Card padding="600">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Zero PII Policy (Personally Identifiable Information)</Text>
                <Text as="p" tone="critical">
                  <strong>We take your customers' privacy seriously. DearRecon does NOT collect, store, or process any Personally Identifiable Information (PII).</strong>
                </Text>
                <Text as="p">
                  This means our application has zero visibility into your customers' sensitive data, including but not limited to:
                </Text>
                <List>
                  <List.Item>Customer names</List.Item>
                  <List.Item>Email addresses</List.Item>
                  <List.Item>Phone numbers</List.Item>
                  <List.Item>Physical shipping or billing addresses</List.Item>
                  <List.Item>Payment credentials or credit card information</List.Item>
                </List>
              </BlockStack>
            </Card>

            <Card padding="600">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Data Retention & Erasure</Text>
                <Text as="p">
                  We strictly comply with Shopify's GDPR and CCPA data privacy requirements. DearRecon fully implements Shopify's mandatory privacy webhooks (<code>customers/data_request</code>, <code>customers/redact</code>, and <code>shop/redact</code>).
                </Text>
                <Text as="p">
                  Upon uninstallation of the DearRecon app from your Shopify Admin, we receive an automated payload from Shopify to instantly erase and purge all associated store data from our servers. You remain in complete control of your data lifecycle.
                </Text>
              </BlockStack>
            </Card>

            <Card padding="600">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Third Parties & Data Sharing</Text>
                <Text as="p">
                  Your store data is processed securely for the sole operational purpose of inventory and refund reconciliation. <strong>We do not sell, rent, or share your data with any external third parties, advertisers, or data brokers.</strong>
                </Text>
              </BlockStack>
            </Card>

            <Card padding="600">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Contact Us</Text>
                <Text as="p">
                  If you have any questions, concerns, or requests regarding this Privacy Policy or how your data is handled, please contact our privacy compliance team at:
                </Text>
                <Link url="mailto:support.dearrecon@gmail.com">support.dearrecon@gmail.com</Link>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
