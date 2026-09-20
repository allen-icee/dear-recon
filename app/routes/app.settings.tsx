import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  PageActions,
  FooterHelp,
  Link,
  Text,
  InlineStack,
  Button
} from "@shopify/polaris";
import prisma from "../db.server";
import { useState, useCallback, useEffect } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  let settings = await prisma.shopSettings.findUnique({ where: { shop } });

  if (!settings) {
    settings = {
      id: "default",
      shop,
      minimumExposure: 0 as any,
      lookbackDays: 30,
      planType: "FREE",
      lastManualScanAt: null,
      autoTagOrders: false,
      autoResolveExceptions: false,
      dailySummaryEmails: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  return { 
    settings: { ...settings, minimumExposure: settings.minimumExposure.toString() },
    planType: settings.planType
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const minimumExposure = formData.get("minimumExposure");
  const lookbackDays = formData.get("lookbackDays");
  const autoTagOrders = formData.get("autoTagOrders") === "true";
  const autoResolveExceptions = formData.get("autoResolveExceptions") === "true";

  await prisma.shopSettings.upsert({
    where: { shop },
    update: {
      minimumExposure: minimumExposure ? Number(minimumExposure) : 0,
      lookbackDays: lookbackDays ? Number(lookbackDays) : 30,
      autoTagOrders,
      autoResolveExceptions,
    },
    create: {
      shop,
      minimumExposure: minimumExposure ? Number(minimumExposure) : 0,
      lookbackDays: lookbackDays ? Number(lookbackDays) : 30,
      autoTagOrders,
      autoResolveExceptions,
    }
  });

  return { success: true };
};

export default function Settings() {
  const { settings, planType } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const nav = useNavigation();
  const actionData = useActionData<typeof action>();
  const isSaving = nav.state === "submitting";
  const isFree = planType === "FREE";

  const [minimumExposure, setMinimumExposure] = useState(settings.minimumExposure);
  const [lookbackDays, setLookbackDays] = useState(settings.lookbackDays?.toString() || "30");
  const [autoTagOrders, setAutoTagOrders] = useState(settings.autoTagOrders);
  const [autoResolveExceptions, setAutoResolveExceptions] = useState(settings.autoResolveExceptions);

  const isDirty =
    minimumExposure !== settings.minimumExposure ||
    lookbackDays !== (settings.lookbackDays?.toString() || "30") ||
    autoTagOrders !== settings.autoTagOrders ||
    autoResolveExceptions !== settings.autoResolveExceptions;

  useEffect(() => {
    if (actionData?.success && typeof shopify !== "undefined") {
      shopify.toast.show("Settings saved successfully");
    }
  }, [actionData]);

  const handleSave = useCallback(() => {
    submit(
      {
        minimumExposure,
        lookbackDays,
        autoTagOrders: autoTagOrders ? "true" : "false",
        autoResolveExceptions: autoResolveExceptions ? "true" : "false",
      },
      { method: "post" }
    );
  }, [minimumExposure, lookbackDays, autoTagOrders, autoResolveExceptions, submit]);

  return (
    <Page
      title="Settings"
      subtitle="Configure how DearRecon scans and automates your store."
      backAction={{ content: 'Dashboard', url: '/app' }}
    >
      <Layout>
        <Layout.AnnotatedSection
          title="Scan Engine"
          description="Define the engine parameters for the daily order scan and threshold limits."
        >
          <Card>
            <BlockStack gap="400">
              <FormLayout>
                <TextField
                  label="Minimum Exposure Threshold"
                  type="number"
                  value={minimumExposure}
                  onChange={setMinimumExposure}
                  autoComplete="off"
                  helpText="Any discrepancy with a total cost below this amount will be automatically ignored to prevent micro-alerts."
                  prefix="$"
                />
                <Select
                  label="Lookback Period"
                  options={[
                    { label: "7 days", value: "7" },
                    { label: "15 days", value: "15" },
                    { label: "30 days", value: "30" },
                    { label: "60 days", value: "60" },
                    { label: "90 days", value: "90" },
                  ]}
                  value={lookbackDays}
                  onChange={setLookbackDays}
                  helpText="Longer periods require more processing time. 30 days is recommended for most stores."
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="Automations & Workflow"
          description="Save time by automating repetitive tasks when exceptions are found."
        >
          <Card>
            <BlockStack gap="400">
              {isFree ? (
                <Card background="bg-surface-warning">
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h3">Pro Feature</Text>
                    <Text as="p">Upgrade to the Pro plan to unlock automations and background workflows.</Text>
                    <InlineStack>
                      <Button url="/app/pricing" size="micro">Upgrade</Button>
                    </InlineStack>
                  </BlockStack>
                </Card>
              ) : (
                <>
                  <Checkbox
                    label="Auto-tag Shopify Orders"
                    helpText="Automatically add a 'DearRecon: Exception' tag to Shopify orders when a discrepancy is detected."
                    checked={autoTagOrders}
                    onChange={setAutoTagOrders}
                  />
                  <Checkbox
                    label="Auto-resolve Minor Exceptions"
                    helpText="Automatically resolve and clear exceptions that fall below your minimum exposure threshold."
                    checked={autoResolveExceptions}
                    onChange={setAutoResolveExceptions}
                  />
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.Section>
          <PageActions
            primaryAction={{
              content: 'Save Configuration',
              onAction: handleSave,
              loading: isSaving,
              disabled: !isDirty,
            }}
          />
        </Layout.Section>

        <Layout.Section>
          <FooterHelp>
            <Text as="span">Need help? Email us at </Text>
            <Text as="span" fontWeight="bold">support@dearrecon.com</Text>.
            <Text as="span"> View our </Text>
            <Link url="https://dear-recon.onrender.com/privacy" target="_blank">Privacy Policy</Link>.
          </FooterHelp>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
