import { useState, useCallback } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Button,
  Text,
  Badge,
  EmptyState,
  Grid,
  BlockStack,
  Modal,
  ChoiceList,
  Link,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { runReconciliationScan } from "../services/reconciliation.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Fetch all reconciliation exceptions for this shop
  const rawExceptions = await prisma.reconciliationException.findMany({
    where: {
      shop: session.shop,
    },
    orderBy: [
      { status: "asc" },
      { estimatedExposure: "desc" },
    ],
  });

  // Explicitly serialize Prisma Decimals and Dates to strings in the backend
  const exceptions = rawExceptions.map((ex) => ({
    ...ex,
    estimatedExposure: ex.estimatedExposure.toString(),
    createdAt: ex.createdAt.toISOString(),
  }));

  return { exceptions };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const intent = formData.get("intent");
  const exceptionId = formData.get("exceptionId")?.toString();
  const resolutionReason = formData.get("resolutionReason")?.toString();

  // Handle the 'resolve' action securely bound to the current shop
  if (intent === "resolve" && exceptionId) {
    await prisma.reconciliationException.updateMany({
      where: {
        id: exceptionId,
        shop: session.shop,
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolutionReason: resolutionReason,
      },
    });
    return { success: true };
  }

  // Handle the 'sync' action
  if (intent === "sync") {
    console.log("🚀 SCAN INITIATED! Fetching orders from Shopify...");
    const result = await runReconciliationScan(admin, session.shop);
    console.log("✅ SCAN COMPLETE! Found:", result);
    return { success: true, result };
  }

  console.error("Missing or invalid intent:", intent);
  throw new Response("Bad Request", { status: 400 });
};

interface ExceptionUI {
  id: string;
  shop: string;
  orderId: string;
  orderName: string;
  lineItemId: string;
  variantId: string;
  sku: string | null;
  refundQuantity: number;
  returnQuantity: number;
  discrepancyQuantity: number;
  estimatedExposure: string;
  currencyCode: string;
  status: string;
  createdAt: string;
  resolutionReason: string | null;
  resolvedBy: string | null;
}

export default function Index() {
  const { exceptions } = useLoaderData<{ exceptions: ExceptionUI[] }>();
  const fetcher = useFetcher();
  const syncFetcher = useFetcher();

  const isSyncing = syncFetcher.state === "submitting" || syncFetcher.state === "loading";
  const isResolving = fetcher.state === "submitting" || fetcher.state === "loading";

  // Modal State
  const [activeExceptionId, setActiveExceptionId] = useState<string | null>(null);
  const [resolutionReason, setResolutionReason] = useState<string[]>(["Restocked"]);

  const handleRunScan = () => {
    const formData = new FormData();
    formData.append("intent", "sync");
    syncFetcher.submit(formData, { method: "POST", action: "?index" });
  };

  const handleResolveSubmit = useCallback(() => {
    if (!activeExceptionId) return;

    const formData = new FormData();
    formData.append("intent", "resolve");
    formData.append("exceptionId", activeExceptionId);
    formData.append("resolutionReason", resolutionReason[0]);

    fetcher.submit(formData, { method: "POST", action: "?index" });
    setActiveExceptionId(null);
  }, [activeExceptionId, resolutionReason, fetcher]);

  const handleModalClose = useCallback(() => {
    setActiveExceptionId(null);
  }, []);

  // Metrics Calculation
  const openExceptionsCount = exceptions.length;
  const estimatedCostExposure = exceptions.reduce((acc, ex) => acc + Number(ex.estimatedExposure), 0);
  const missingItems = exceptions.reduce((acc, ex) => acc + ex.discrepancyQuantity, 0);

  const formattedTotalExposure = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: exceptions.length > 0 ? exceptions[0].currencyCode : "USD",
  }).format(estimatedCostExposure);

  const emptyStateMarkup = (
    <EmptyState
      heading="✓ You're all caught up"
      action={{ content: "Run Scan", onAction: handleRunScan }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>DearRecon checked your recent refunds and returns. No reconciliation exceptions were found.</p>
    </EmptyState>
  );

  const rowMarkup = exceptions.map((ex, index) => {
    const formattedExposure = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: ex.currencyCode,
    }).format(Number(ex.estimatedExposure));

    const ageInDays = Math.floor((new Date().getTime() - new Date(ex.createdAt).getTime()) / (1000 * 3600 * 24));

    // Convert gid://shopify/Order/123 to just 123 for the URL
    const numericOrderId = ex.orderId.split("/").pop();

    return (
      <IndexTable.Row id={ex.id} key={ex.id} position={index}>
        <IndexTable.Cell>
          <Link url={`shopify:admin/orders/${numericOrderId}`} target="_parent">
            <Text variant="bodyMd" fontWeight="bold" as="span">
              {ex.orderName}
            </Text>
          </Link>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone="warning">Missing Return</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{ex.sku || "N/A"}</IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" tone="critical" as="span">
            {ex.discrepancyQuantity}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {formattedExposure}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {ageInDays === 0 ? "Today" : `${ageInDays} day${ageInDays > 1 ? "s" : ""}`}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone="info">{ex.status}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {ex.status === "OPEN" ? (
            <Button size="micro" onClick={() => setActiveExceptionId(ex.id)}>
              Resolve
            </Button>
          ) : ex.status === "RESOLVED" ? (
            <Badge tone="success">{`Resolved: ${ex.resolutionReason || "Unknown"}`}</Badge>
          ) : null}
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Reconciliation Dashboard"
      primaryAction={{
        content: "Run Daily Scan",
        loading: isSyncing,
        onAction: handleRunScan,
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* Top Metrics Cards */}
            <Grid>
              <Grid.Cell columnSpan={{ xs: 6, sm: 4, md: 4, lg: 4, xl: 4 }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">Open Exceptions</Text>
                    <Text as="p" variant="headingLg">{openExceptionsCount}</Text>
                  </BlockStack>
                </Card>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 4, md: 4, lg: 4, xl: 4 }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">Estimated Cost Exposure</Text>
                    <Text as="p" variant="headingLg" tone="critical">{formattedTotalExposure}</Text>
                  </BlockStack>
                </Card>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 4, md: 4, lg: 4, xl: 4 }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">Missing Items</Text>
                    <Text as="p" variant="headingLg">{missingItems}</Text>
                  </BlockStack>
                </Card>
              </Grid.Cell>
            </Grid>

            {/* Exception Table */}
            <Card padding="0">
              {exceptions.length === 0 ? (
                emptyStateMarkup
              ) : (
                <IndexTable
                  resourceName={{ singular: "exception", plural: "exceptions" }}
                  itemCount={exceptions.length}
                  headings={[
                    { title: "Order" },
                    { title: "Issue" },
                    { title: "Item" },
                    { title: "Qty" },
                    { title: "Exposure" },
                    { title: "Age" },
                    { title: "Status" },
                    { title: "" }, // For the resolve button
                  ]}
                  selectable={false}
                >
                  {rowMarkup}
                </IndexTable>
              )}
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

      {/* Resolution Modal */}
      <Modal
        open={activeExceptionId !== null}
        onClose={handleModalClose}
        title="Mark exception as resolved?"
        primaryAction={{
          content: "Submit Resolution",
          onAction: handleResolveSubmit,
          loading: isResolving,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: handleModalClose,
          },
        ]}
      >
        <Modal.Section>
          <ChoiceList
            title="Reason"
            choices={[
              { label: "Restocked", value: "Restocked" },
              { label: "Manual adjustment", value: "Manual adjustment" },
              { label: "False positive", value: "False positive" },
              { label: "Other", value: "Other" },
            ]}
            selected={resolutionReason}
            onChange={setResolutionReason}
          />
        </Modal.Section>
      </Modal>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};