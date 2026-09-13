import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation, Form } from "react-router";
import { Page, Layout, Card, Text, Button, BlockStack, InlineStack, List, Badge, Box, Grid } from "@shopify/polaris";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { session, admin, billing } = await authenticate.admin(request);
  const settings = await prisma.shopSettings.findUnique({ where: { shop: session.shop } });
  

  const billingCheck = await billing.check({
    plans: [MONTHLY_PLAN],
    isTest: true,
  });

  const hasActiveSubscription = billingCheck.hasActivePayment;
  
  if (hasActiveSubscription && settings?.planType !== "PRO") {

     await prisma.shopSettings.update({
       where: { shop: session.shop },
       data: { planType: "PRO" }
     });
  } else if (!hasActiveSubscription && settings?.planType === "PRO") {

      await prisma.shopSettings.update({
          where: { shop: session.shop },
          data: { planType: "FREE" }
      });
  }

  return { planType: hasActiveSubscription ? "PRO" : (settings?.planType || "FREE") };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { session, admin, billing } = await authenticate.admin(request);
  const formData = await request.formData();

  if (formData.get("intent") === "downgrade") {
    const billingCheck = await billing.check({
      plans: [MONTHLY_PLAN],
      isTest: true,
    });

    if (billingCheck.hasActivePayment) {
      await billing.cancel({
        subscriptionId: billingCheck.appSubscriptions[0].id,
        isTest: true,
        prorate: true,
      });
    }

    await prisma.shopSettings.update({
      where: { shop: session.shop },
      data: { planType: "FREE" },
    });
    
    return { success: true };
  }

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
          <Grid>
            {/* Free Tier */}
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
              <Card padding="600">
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <Text variant="headingLg" as="h2">Standard</Text>
                    <Text variant="heading3xl" as="p">Free</Text>
                  </BlockStack>
                  <List>
                    <List.Item>1 manual scan per 24 hours</List.Item>
                    <List.Item>Full audit & resolution workflow</List.Item>
                    <List.Item>Community support</List.Item>
                    <List.Item>No CSV Exports</List.Item>
                  </List>
                  <Box paddingBlockStart="200">
                    {planType === "FREE" ? (
                      <Button disabled size="large" fullWidth>Current Plan</Button>
                    ) : (
                      <Form method="post">
                        <input type="hidden" name="intent" value="downgrade" />
                        <Button submit size="large" fullWidth>Downgrade to Free</Button>
                      </Form>
                    )}
                  </Box>
                </BlockStack>
              </Card>
            </Grid.Cell>

            {/* Pro Tier Card */}
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
              <Card background="bg-surface-secondary" padding="600">
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text variant="headingLg" as="h2">Pro</Text>
                      <Badge tone="success">Recommended</Badge>
                    </InlineStack>
                    <Text variant="heading3xl" as="p">$9 <Text variant="bodyLg" as="span" tone="subdued">/ mo</Text></Text>
                    <Text variant="bodyMd" as="p" tone="subdued">7-day free trial</Text>
                  </BlockStack>
                  <List>
                    <List.Item>
                      <Text as="span" fontWeight="bold">Real-time background sync (Webhooks)</Text>
                    </List.Item>
                    <List.Item>Unlimited manual scans</List.Item>
                    <List.Item>Priority support</List.Item>
                    <List.Item>CSV Data Exports</List.Item>
                  </List>
                  <Box paddingBlockStart="200">
                    <Button 
                      variant={planType === "PRO" ? undefined : "primary"}
                      disabled={planType === "PRO"} 
                      onClick={handleUpgrade}
                      loading={isUpgrading}
                      size="large"
                      fullWidth
                    >
                      {planType === "PRO" ? "Current Plan" : "Upgrade to Pro"}
                    </Button>
                  </Box>
                </BlockStack>
              </Card>
            </Grid.Cell>
          </Grid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
