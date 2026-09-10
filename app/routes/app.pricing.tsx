import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import { Page, Layout, Card, Text, Button, BlockStack, InlineStack, List, Badge, Box } from "@shopify/polaris";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const settings = await prisma.shopSettings.findUnique({ where: { shop: session.shop } });
  
  // Check if they already have an active subscription via shopify billing
  const billingCheck = await billing.check({
    plans: [MONTHLY_PLAN],
    isTest: true,
  });

  const hasActiveSubscription = billingCheck.hasActivePayment;
  
  if (hasActiveSubscription && settings?.planType !== "PRO") {
     // sync it just in case
     await prisma.shopSettings.update({
       where: { shop: session.shop },
       data: { planType: "PRO" }
     });
  } else if (!hasActiveSubscription && settings?.planType === "PRO") {
      // Downgrade if the subscription was cancelled
      await prisma.shopSettings.update({
          where: { shop: session.shop },
          data: { planType: "FREE" }
      });
  }

  return { planType: hasActiveSubscription ? "PRO" : (settings?.planType || "FREE") };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  return await billing.request({
    plan: MONTHLY_PLAN,
    isTest: true,
  });
};

export default function Pricing() {
  const { planType } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const nav = useNavigation();

  const handleUpgrade = () => {
    submit({}, { method: "post" });
  };

  const isUpgrading = nav.state === "submitting";

  return (
    <Page title="Pricing & Plans">
      <Layout>
        <Layout.Section>
          <InlineStack align="center" gap="800">
            {/* Free Tier Card */}
            <Box minWidth="300px">
              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <Text variant="headingLg" as="h2">Standard</Text>
                    <Text variant="headingXl" as="p">Free</Text>
                  </BlockStack>
                  <List>
                    <List.Item>1 manual scan per 24 hours</List.Item>
                    <List.Item>Full audit & resolution workflow</List.Item>
                    <List.Item>Community support</List.Item>
                  </List>
                  <Button disabled={planType === "FREE"}>
                    {planType === "FREE" ? "Current Plan" : "Downgrade (Contact Support)"}
                  </Button>
                </BlockStack>
              </Card>
            </Box>

            {/* Pro Tier Card */}
            <Box minWidth="300px">
              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text variant="headingLg" as="h2">Pro</Text>
                      <Badge tone="success">Recommended</Badge>
                    </InlineStack>
                    <Text variant="headingXl" as="p">$9 <Text variant="bodyMd" as="span" tone="subdued">/ mo</Text></Text>
                    <Text variant="bodyMd" as="p" tone="subdued">7-day free trial</Text>
                  </BlockStack>
                  <List>
                    <List.Item>Real-time background sync (Webhooks)</List.Item>
                    <List.Item>Unlimited manual scans</List.Item>
                    <List.Item>Priority support</List.Item>
                  </List>
                  <Button 
                    variant={planType === "PRO" ? undefined : "primary"}
                    disabled={planType === "PRO"} 
                    onClick={handleUpgrade}
                    loading={isUpgrading}
                  >
                    {planType === "PRO" ? "Current Plan" : "Upgrade to Pro"}
                  </Button>
                </BlockStack>
              </Card>
            </Box>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
