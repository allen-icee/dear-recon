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
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { runReconciliationScan } from "../services/reconciliation.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Fetch all open reconciliation exceptions for this shop
  const rawExceptions = await prisma.reconciliationException.findMany({
    where: {
      shop: session.shop,
      status: "OPEN",
    },
    orderBy: {
      estimatedExposure: "desc",
    },
  });

  // Explicitly serialize Prisma Decimals to strings in the backend
  const exceptions = rawExceptions.map((ex) => ({
    ...ex,
    estimatedExposure: ex.estimatedExposure.toString(),
  }));

  return { exceptions };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const intent = formData.get("intent");
  const exceptionId = formData.get("exceptionId")?.toString();

  // Handle the 'resolve' action securely bound to the current shop
  if (intent === "resolve" && exceptionId) {
    await prisma.reconciliationException.updateMany({
      where: {
        id: exceptionId, // FIXED: Prisma is expecting a String UUID here
        shop: session.shop,
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
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
  id: string; // FIXED: ID is a string in the database
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
}

export default function Index() {
  const { exceptions } = useLoaderData<{ exceptions: ExceptionUI[] }>();
  const fetcher = useFetcher();
  const syncFetcher = useFetcher();

  const isSyncing =
    syncFetcher.state === "submitting" || syncFetcher.state === "loading";

  const handleRunScan = () => {
    const formData = new FormData();
    formData.append("intent", "sync");

    syncFetcher.submit(formData, {
      method: "POST",
      action: "?index"
    });
  };

  const emptyStateMarkup = (
    <EmptyState
      heading="You're all caught up!"
      action={{ content: "Refresh Data", onAction: () => window.location.reload() }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>All refunds and returns are fully reconciled.</p>
    </EmptyState>
  );

  const rowMarkup = exceptions.map(
    (
      {
        id,
        orderName,
        sku,
        refundQuantity,
        returnQuantity,
        discrepancyQuantity,
        estimatedExposure,
        currencyCode,
      },
      index
    ) => {
      // Safely format the string exposure back into a localized currency number
      const formattedExposure = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
      }).format(Number(estimatedExposure));

      return (
        <IndexTable.Row id={id} key={id} position={index}>
          <IndexTable.Cell>
            <Text variant="bodyMd" fontWeight="bold" as="span">
              {orderName}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>{sku || "N/A"}</IndexTable.Cell>
          <IndexTable.Cell>{String(refundQuantity)}</IndexTable.Cell>
          <IndexTable.Cell>{String(returnQuantity)}</IndexTable.Cell>
          <IndexTable.Cell>
            <Badge tone="critical">{`${discrepancyQuantity} missing`}</Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodyMd" tone="critical" as="span">
              {formattedExposure}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <fetcher.Form method="POST" action="?index">
              <input type="hidden" name="intent" value="resolve" />
              <input type="hidden" name="exceptionId" value={id} />
              <Button submit size="micro">
                Resolve
              </Button>
            </fetcher.Form>
          </IndexTable.Cell>
        </IndexTable.Row>
      );
    }
  );

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
          <Card padding="0">
            {exceptions.length === 0 ? (
              emptyStateMarkup
            ) : (
              <IndexTable
                resourceName={{ singular: "exception", plural: "exceptions" }}
                itemCount={exceptions.length}
                headings={[
                  { title: "Order" },
                  { title: "SKU" },
                  { title: "Refund Qty" },
                  { title: "Return Qty" },
                  { title: "Discrepancy" },
                  { title: "Exposure" },
                  { title: "Action" },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};