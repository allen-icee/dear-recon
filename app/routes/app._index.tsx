import { useState, useCallback, useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useFetcher, useNavigation } from "react-router";
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
  Tabs,
  Banner,
  TextField,
  Pagination,
  Box,
  SkeletonBodyText,
  Tooltip,
  InlineStack,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { runReconciliationScan } from "../services/reconciliation.server";
import { DashboardEmptyState } from "../components/dashboard/DashboardEmptyState";
import { OnboardingBanner } from "../components/dashboard/OnboardingBanner";
import { ExceptionDetailModal, ExceptionUI } from "../components/dashboard/ExceptionDetailModal";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  let settings = await prisma.shopSettings.findUnique({
    where: { shop: session.shop },
  });

  if (!settings) {
    settings = await prisma.shopSettings.create({
      data: { shop: session.shop },
    });
  }

  const planType = settings.planType;
  let cooldownRemaining = 0;
  
  if (planType === "FREE" && settings.lastManualScanAt) {
    const elapsed = Date.now() - new Date(settings.lastManualScanAt).getTime();
    if (elapsed < 86400000) {
      cooldownRemaining = 86400000 - elapsed;
    }
  }

  const rawExceptions = await prisma.reconciliationException.findMany({
    where: {
      shop: session.shop,
    },
    orderBy: [
      { status: "asc" },
      { estimatedExposure: "desc" },
    ],
  });

  const exceptions = rawExceptions.map((ex) => ({
    ...ex,
    estimatedExposure: ex.estimatedExposure.toString(),
    createdAt: ex.createdAt.toISOString(),
  }));

  return { exceptions, planType, cooldownRemaining };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const intent = formData.get("intent");
  const exceptionId = formData.get("exceptionId")?.toString();
  const resolutionReason = formData.get("resolutionReason")?.toString();

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

  if (intent === "sync") {
    let settings = await prisma.shopSettings.findUnique({
      where: { shop: session.shop },
    });
    
    if (!settings) {
      settings = await prisma.shopSettings.create({
        data: { shop: session.shop },
      });
    }

    if (settings.planType === "FREE" && settings.lastManualScanAt) {
      const elapsed = Date.now() - new Date(settings.lastManualScanAt).getTime();
      if (elapsed < 86400000) {
        return { success: false, error: "Cooldown active", remainingTime: 86400000 - elapsed };
      }
    }

    console.log("🚀 SCAN INITIATED! Fetching orders from Shopify...");
    const result = await runReconciliationScan(admin, session.shop);
    console.log("✅ SCAN COMPLETE! Found:", result);
    
    await prisma.shopSettings.update({
      where: { shop: session.shop },
      data: { lastManualScanAt: new Date() },
    });

    return { success: true, result };
  }

  console.error("Missing or invalid intent:", intent);
  throw new Response("Bad Request", { status: 400 });
};



export default function Index() {
  const { exceptions, planType, cooldownRemaining } = useLoaderData<{ exceptions: ExceptionUI[], planType: string, cooldownRemaining: number }>();
  const fetcher = useFetcher();
  const syncFetcher = useFetcher();
  const nav = useNavigation();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      shopify.toast.show("Exception resolved");
    }
  }, [fetcher.state, fetcher.data, shopify]);

  useEffect(() => {
    if (syncFetcher.state === "idle" && syncFetcher.data?.success) {
      shopify.toast.show("Manual scan complete");
    }
  }, [syncFetcher.state, syncFetcher.data, shopify]);

  const isSyncing = syncFetcher.state === "submitting" || syncFetcher.state === "loading";
  const isResolving = fetcher.state === "submitting" || fetcher.state === "loading";

  const [activeException, setActiveException] = useState<ExceptionUI | null>(null);
  
  // UX Enhancements State
  const [selectedTab, setSelectedTab] = useState(0);
  const [queryValue, setQueryValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showBanner, setShowBanner] = useState(true);

  const [remainingTime, setRemainingTime] = useState(cooldownRemaining);

  useEffect(() => {
    if (remainingTime > 0) {
      const interval = setInterval(() => {
        setRemainingTime(prev => Math.max(0, prev - 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [remainingTime]);

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const isCooldownActive = planType === "FREE" && remainingTime > 0;

  const handleRunScan = () => {
    const formData = new FormData();
    formData.append("intent", "sync");
    syncFetcher.submit(formData, { method: "POST", action: "?index" });
  };

  const handleResolveSubmit = useCallback((exceptionId: string, reason: string) => {
    const formData = new FormData();
    formData.append("intent", "resolve");
    formData.append("exceptionId", exceptionId);
    formData.append("resolutionReason", reason);
    fetcher.submit(formData, { method: "POST", action: "?index" });
    setActiveException(null);
  }, [fetcher]);

  const handleModalClose = useCallback(() => {
    setActiveException(null);
  }, []);

  const handleTabChange = useCallback((selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
    setCurrentPage(1); // Reset pagination on tab change
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setQueryValue(value);
    setCurrentPage(1); // Reset pagination on search
  }, []);

  // Filter and Paginate Data
  const filteredExceptions = exceptions.filter((ex) => {
    const statusMatch = selectedTab === 0 ? ex.status === "OPEN" : ex.status === "RESOLVED";
    if (!statusMatch) return false;

    if (queryValue) {
      const q = queryValue.toLowerCase();
      const orderMatch = ex.orderName.toLowerCase().includes(q);
      const skuMatch = (ex.sku || "").toLowerCase().includes(q);
      return orderMatch || skuMatch;
    }
    return true;
  });

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredExceptions.length / itemsPerPage);
  const paginatedExceptions = filteredExceptions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Metrics Calculation (only on OPEN items)
  const openExceptions = exceptions.filter(ex => ex.status === "OPEN");
  const openExceptionsCount = openExceptions.length;
  const estimatedCostExposure = openExceptions.reduce((acc, ex) => acc + Number(ex.estimatedExposure), 0);
  const missingItems = openExceptions.reduce((acc, ex) => acc + ex.discrepancyQuantity, 0);

  const formattedTotalExposure = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: exceptions.length > 0 ? exceptions[0].currencyCode : "USD",
  }).format(estimatedCostExposure);



  const rowMarkup = paginatedExceptions.map((ex, index) => {
    const formattedExposure = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: ex.currencyCode,
    }).format(Number(ex.estimatedExposure));

    const ageInDays = Math.floor((new Date().getTime() - new Date(ex.createdAt).getTime()) / (1000 * 3600 * 24));
    const numericOrderId = ex.orderId.split("/").pop();

    return (
      <IndexTable.Row id={ex.id} key={ex.id} position={index}>
        <IndexTable.Cell>
          <Link url={`shopify:admin/orders/${numericOrderId}`} target="_parent">
            <Text variant="bodyMd" fontWeight="bold" as="span" truncate>
              {ex.orderName}
            </Text>
          </Link>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Tooltip content="Item was refunded but not physically returned to inventory">
            <Text as="span">
              <Badge tone="warning">Missing Return</Badge>
            </Text>
          </Tooltip>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text truncate as="span">
            {ex.sku || "N/A"}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" tone="critical" as="span">
            {ex.discrepancyQuantity}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" alignment="end">
            {formattedExposure}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {ageInDays === 0 ? "Today" : `${ageInDays} day${ageInDays > 1 ? "s" : ""}`}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={ex.status === "OPEN" ? "info" : "success"}>{ex.status}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button size="micro" onClick={() => setActiveException(ex)}>
            {ex.status === "OPEN" ? "Investigate" : "View"}
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="DearRecon"
      subtitle="Refund & Return Reconciliation"
      primaryAction={
        planType === "FREE"
          ? {
              content: "Upgrade to Pro",
              url: "/app/pricing",
            }
          : undefined
      }
    >
      <BlockStack gap="400">
        <Box paddingBlockEnd="200">
          <InlineStack align="end">
            <Tooltip content="Free tier allows 1 scan per 24 hours. Upgrade to Pro for unlimited scans.">
              <Button 
                variant="primary" 
                onClick={handleRunScan} 
                disabled={isCooldownActive} 
                loading={isSyncing}
              >
                {isCooldownActive ? `Next scan available in ${formatTime(remainingTime)}` : "Run Daily Scan"}
              </Button>
            </Tooltip>
          </InlineStack>
        </Box>

        {showBanner && (
          <OnboardingBanner onDismiss={() => setShowBanner(false)} />
        )}

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
                <Tabs
                  tabs={[
                    { 
                      id: 'open', 
                      content: 'Action Required',
                      badge: openExceptionsCount > 0 ? openExceptionsCount.toString() : undefined,
                      accessibilityLabel: 'Open exceptions' 
                    },
                    { id: 'resolved', content: 'Audit History', accessibilityLabel: 'Resolved exceptions' },
                  ]}
                  selected={selectedTab}
                  onSelect={handleTabChange}
                >
                  <Box padding="400" paddingBlockEnd="0">
                    <TextField
                      label="Search exceptions"
                      labelHidden
                      value={queryValue}
                      onChange={handleSearchChange}
                      placeholder="Search by order ID or SKU"
                      autoComplete="off"
                      clearButton
                      onClearButtonClick={() => handleSearchChange('')}
                    />
                  </Box>
                  <Box paddingBlockStart="400">
                    {filteredExceptions.length === 0 ? (
                      <DashboardEmptyState
                        selectedTab={selectedTab}
                        handleManualScan={handleRunScan}
                        isSyncing={isSyncing}
                        cooldownRemaining={cooldownRemaining}
                        planType={planType}
                        isCooldownActive={isCooldownActive}
                      />
                    ) : (
                      <>
                        <IndexTable
                          resourceName={{ singular: "exception", plural: "exceptions" }}
                          itemCount={paginatedExceptions.length}
                          headings={[
                            { title: "Order" },
                            { title: "Issue" },
                            { title: "Item" },
                            { title: "Qty" },
                            { title: "Exposure", alignment: "end" },
                            { title: "Age" },
                            { title: "Status" },
                            { title: "" }, // For the resolve button
                          ]}
                          selectable={false}
                        >
                          {nav.state === "loading" || isSyncing ? (
                            <IndexTable.Row id="loading-skeleton" position={0}>
                              <IndexTable.Cell colSpan={8}>
                                <Box paddingBlockStart="200" paddingBlockEnd="200">
                                  <SkeletonBodyText lines={Math.max(paginatedExceptions.length, 5)} />
                                </Box>
                              </IndexTable.Cell>
                            </IndexTable.Row>
                          ) : (
                            rowMarkup
                          )}
                        </IndexTable>
                        {totalPages > 1 && (
                          <Box padding="400">
                            <BlockStack inlineAlign="center">
                              <Pagination
                                hasPrevious={currentPage > 1}
                                onPrevious={() => setCurrentPage((prev) => prev - 1)}
                                hasNext={currentPage < totalPages}
                                onNext={() => setCurrentPage((prev) => prev + 1)}
                                label={`${currentPage} of ${totalPages}`}
                              />
                            </BlockStack>
                          </Box>
                        )}
                      </>
                    )}
                  </Box>
                </Tabs>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>

      <ExceptionDetailModal
        activeException={activeException}
        onClose={handleModalClose}
        onResolve={handleResolveSubmit}
        isResolving={isResolving}
      />
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};