import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation, Form, useActionData, useSearchParams } from "react-router";
import { useEffect, useState, useCallback } from "react";

import { Page, Layout, Card, Text, Button, BlockStack, InlineStack, List, Badge, Box, Grid, Modal, FooterHelp, Link } from "@shopify/polaris";
import { authenticate, PRO_PLAN } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { session, admin, billing } = await authenticate.admin(request);
  const settings = await prisma.shopSettings.findUnique({ where: { shop: session.shop } });
  

  const billingCheck = await billing.check({
    plans: [PRO_PLAN],
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
  const { billing, redirect } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "downgrade") {
    const check = await billing.check({
      plans: ["Pro Plan"],
      isTest: true,
    });

    if (check.hasActivePayment) {
      await billing.cancel({
        subscriptionId: check.appSubscriptions[0].id,
        isTest: true,
        prorate: true,
      });
    }

    return redirect("/app/pricing?success=downgraded");
  }

  if (intent === "upgrade") {
    try {
      await billing.request({ 
        plan: "Pro Plan", 
        isTest: true 
      });
    } catch (error: any) {
      if (error instanceof Response && error.status === 401) {
        const reauthUrl = error.headers.get("X-Shopify-API-Request-Failure-Reauthorize-Url");
        if (reauthUrl) {
          return { redirectUrl: reauthUrl };
        }
      }
      throw error;
    }
  }
  return null;
};

export default function Pricing() {
  const { planType } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const nav = useNavigation();
  const actionData = useActionData<any>();

  useEffect(() => {
    if (actionData?.redirectUrl) {
      window.open(actionData.redirectUrl, "_top");
    }
  }, [actionData]);

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("success") === "downgraded" && typeof shopify !== "undefined") {
      shopify.toast.show("Successfully downgraded to the Free plan");
      setSearchParams(new URLSearchParams());
    }
  }, [searchParams, setSearchParams]);

  const isUpgrading = nav.state === "submitting" && nav.formData?.get("intent") === "upgrade";
  const isDowngrading = nav.state === "submitting" && nav.formData?.get("intent") === "downgrade";

  const [isDowngradeModalOpen, setIsDowngradeModalOpen] = useState(false);

  const toggleDowngradeModal = useCallback(() => {
    setIsDowngradeModalOpen((active) => !active);
  }, []);

  const handleDowngrade = useCallback(() => {
    submit({ intent: "downgrade" }, { method: "post" });
    setIsDowngradeModalOpen(false);
  }, [submit]);

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
                      <>
                        <Button onClick={toggleDowngradeModal} loading={isDowngrading} size="large" fullWidth>Downgrade to Free</Button>
                        <Modal
                          open={isDowngradeModalOpen}
                          onClose={toggleDowngradeModal}
                          title="Confirm Downgrade"
                          primaryAction={{
                            content: 'Downgrade',
                            onAction: handleDowngrade,
                            destructive: true,
                          }}
                          secondaryActions={[
                            {
                              content: 'Cancel',
                              onAction: toggleDowngradeModal,
                            },
                          ]}
                        >
                          <Modal.Section>
                            <Text as="p">
                              Are you sure you want to downgrade to the Standard Free plan? You will immediately lose access to background syncs, unlimited scans, and CSV exports.
                            </Text>
                          </Modal.Section>
                        </Modal>
                      </>
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
                    <List.Item>Automated Order Tagging</List.Item>
                    <List.Item>Auto-resolve minor exceptions</List.Item>
                    <List.Item>Unlimited manual scans</List.Item>
                    <List.Item>Priority support</List.Item>
                    <List.Item>CSV Data Exports</List.Item>
                  </List>
                  <Box paddingBlockStart="200">
                    {planType === "PRO" ? (
                      <Button disabled size="large" fullWidth>Current Plan</Button>
                    ) : (
                      <Form method="post">
                        <input type="hidden" name="intent" value="upgrade" />
                        <Button submit variant="primary" loading={isUpgrading} size="large" fullWidth>
                          Upgrade to Pro
                        </Button>
                      </Form>
                    )}
                  </Box>
                </BlockStack>
              </Card>
            </Grid.Cell>
          </Grid>
        </Layout.Section>
        <Layout.Section>
          <FooterHelp>
            <Text as="span">Need help? Email us at </Text>
            <Text as="span" fontWeight="bold">support.dearrecon@gmail.com</Text>.
            <Text as="span"> View our </Text>
            <Link url="https://dear-recon.onrender.com/privacy" target="_blank">Privacy Policy</Link>.
          </FooterHelp>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
