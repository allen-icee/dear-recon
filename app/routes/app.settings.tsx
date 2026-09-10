import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  FormLayout,
  TextField,
  Select,
  Button,
  Text,
} from "@shopify/polaris";
import { SaveBar } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import { useState, useCallback } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let settings = await prisma.shopSettings.findUnique({ where: { shop } });
  
  if (!settings) {
    settings = {
      id: "default",
      shop,
      minimumExposure: 0 as any, // Temporary cast, will be sent as string anyway
      lookbackDays: 30,
      planType: "FREE",
      lastManualScanAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  return { settings: { ...settings, minimumExposure: settings.minimumExposure.toString() } };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  const formData = await request.formData();
  const minimumExposure = formData.get("minimumExposure");
  const lookbackDays = formData.get("lookbackDays");

  await prisma.shopSettings.upsert({
    where: { shop },
    update: {
      minimumExposure: minimumExposure ? Number(minimumExposure) : 0,
      lookbackDays: lookbackDays ? Number(lookbackDays) : 30,
    },
    create: {
      shop,
      minimumExposure: minimumExposure ? Number(minimumExposure) : 0,
      lookbackDays: lookbackDays ? Number(lookbackDays) : 30,
    }
  });

  return { success: true };
};

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const nav = useNavigation();
  const isSaving = nav.state === "submitting";

  const [minimumExposure, setMinimumExposure] = useState(settings.minimumExposure);
  const [lookbackDays, setLookbackDays] = useState(settings.lookbackDays?.toString() || "30");

  const isDirty = minimumExposure !== settings.minimumExposure || lookbackDays !== (settings.lookbackDays?.toString() || "30");

  const handleSave = useCallback(() => {
    submit(
      { minimumExposure, lookbackDays },
      { method: "post" }
    );
  }, [minimumExposure, lookbackDays, submit]);

  const handleDiscard = useCallback(() => {
    setMinimumExposure(settings.minimumExposure);
    setLookbackDays(settings.lookbackDays?.toString() || "30");
  }, [settings]);

  return (
    <Page 
      title="DearRecon"
      subtitle="Engine Configuration"
      backAction={{ content: 'Dashboard', url: '/app' }}
    >
      {isDirty && (
        <SaveBar id="my-save-bar">
          <button variant="primary" id="save" onClick={handleSave} disabled={isSaving}>Save</button>
          <button id="discard" onClick={handleDiscard} disabled={isSaving}>Discard</button>
        </SaveBar>
      )}
      <Layout>
        <Layout.AnnotatedSection
          title="Reconciliation Configuration"
          description="Define the engine parameters for the daily order scan and how exceptions are handled."
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
                  helpText="Discrepancies below this dollar amount will be automatically ignored."
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
                  helpText="How far back should manual daily scans check for order modifications?"
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>
      </Layout>
    </Page>
  );
}
