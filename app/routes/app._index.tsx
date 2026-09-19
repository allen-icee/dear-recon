import { useState, useCallback, useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useFetcher, useNavigation, useNavigate, useLocation } from "react-router";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Button,
  Text,
  Badge,
  Grid,
  BlockStack,
  Link,
  Pagination,
  Box,
  SkeletonBodyText,
  Tooltip,
  TextField,
  useIndexResourceState,
  IndexFilters,
  useSetIndexFiltersMode,
  IndexFiltersMode,
  Modal,
  Select,
  Frame,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate, PRO_PLAN } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { runReconciliationScan } from "../services/reconciliation.server";
import { OnboardingBanner } from "../components/dashboard/OnboardingBanner";
import { DashboardEmptyState } from "../components/dashboard/DashboardEmptyState";
import { ExceptionDetailModal, type ExceptionUI } from "../components/dashboard/ExceptionDetailModal";
import { MetricsOverview } from "../components/dashboard/MetricsOverview";
import { BulkResolveModal } from "../components/dashboard/BulkResolveModal";

/**
 * Loader function: Fetches settings and existing exceptions concurrently to serve the initial UI state.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);

  const [settingsResult, rawExceptions] = await Promise.all([
    prisma.shopSettings.findUnique({
      where: { shop: session.shop },
      select: { planType: true, lastManualScanAt: true }
    }),
    prisma.reconciliationException.findMany({
      where: { shop: session.shop },
      orderBy: [
        { status: "asc" },
        { estimatedExposure: "desc" },
      ],
      select: {
        id: true,
        shop: true,
        orderId: true,
        orderName: true,
        itemName: true,
        lineItemId: true,
        variantId: true,
        sku: true,
        refundQuantity: true,
        returnQuantity: true,
        discrepancyQuantity: true,
        estimatedExposure: true,
        currencyCode: true,
        status: true,
        createdAt: true,
        resolutionReason: true,
        resolvedBy: true,
        resolvedAt: true
      }
    })
  ]);

  let settings = settingsResult;
  if (!settings) {
    settings = await prisma.shopSettings.create({
      data: { shop: session.shop },
      select: { planType: true, lastManualScanAt: true }
    });
  }

  const billingCheck = await billing.check({
    plans: [PRO_PLAN],
    isTest: true,
  });

  const planType = billingCheck.hasActivePayment ? "PRO" : "FREE";
  let cooldownRemaining = 0;

  if (planType === "FREE" && settings.lastManualScanAt) {
    const elapsed = Date.now() - new Date(settings.lastManualScanAt).getTime();
    if (elapsed < 86400000) {
      cooldownRemaining = 86400000 - elapsed;
    }
  }

  const exceptions = rawExceptions.map((ex) => ({
    ...ex,
    estimatedExposure: ex.estimatedExposure.toString(),
    createdAt: ex.createdAt.toISOString(),
    resolvedAt: ex.resolvedAt ? ex.resolvedAt.toISOString() : null,
  }));

  return Response.json({ exceptions, planType, cooldownRemaining });
};

/**
 * Action function: Handles UI form submissions like resolving exceptions, reopening them, or triggering manual scans.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const intent = formData.get("intent");
  console.log("Backend: Received POST request with intent:", intent);
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
        resolvedBy: session.shop,
      },
    });
    return { success: true, intent: "resolve" };
  }

  if (intent === "bulk_resolve") {
    const idsString = formData.get("ids")?.toString();
    const bulkReason = formData.get("bulkReason")?.toString() || "Bulk Resolved manually";
    const ids = idsString ? JSON.parse(idsString) : [];
    if (ids.length > 0) {
      await prisma.reconciliationException.updateMany({
        where: {
          id: { in: ids },
          shop: session.shop,
        },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolutionReason: bulkReason,
          resolvedBy: session.shop,
        },
      });
    }
    return { success: true, intent: "bulk_resolve" };
  }

  if (intent === "reopen") {
    const id = formData.get("id");
    console.log("Backend: Attempting DB update for Reopen ID:", id);
    if (id) {
      try {
        await prisma.reconciliationException.update({
          where: { id: String(id) },
          data: {
            status: "OPEN",
            resolvedAt: null,
            resolutionReason: null,
            resolvedBy: null,
          },
        });
        return { success: true, intent: "reopen" };
      } catch (error) {
        console.error("Backend: Prisma DB Error during reopen:", error);
        return { success: false, error: String(error) };
      }
    }
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
  const navigate = useNavigate();
  const location = useLocation();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      if (fetcher.data.intent === "bulk_resolve") {
        shopify.toast.show("Exceptions bulk resolved");
      } else if (fetcher.data.intent === "resolve") {
        shopify.toast.show("Exception resolved");
      } else if (fetcher.data.intent === "reopen") {
        shopify.toast.show("Exception reopened");
      }
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
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  const [selectedTab, setSelectedTab] = useState(0);
  const [queryValue, setQueryValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showBanner, setShowBanner] = useState(true);

  const [sortSelected, setSortSelected] = useState<string[]>(['date desc']);
  const { mode, setMode } = useSetIndexFiltersMode(IndexFiltersMode.Default);
  const [minExposure, setMinExposure] = useState<string>('');

  const appliedFilters = minExposure && !isNaN(Number(minExposure)) && Number(minExposure) > 0
    ? [
      {
        key: 'minExposure',
        label: `Min Exposure: $${minExposure}`,
        onRemove: () => setMinExposure(''),
      },
    ]
    : [];

  const handleClearAll = useCallback(() => {
    setQueryValue('');
    setMinExposure('');
  }, []);

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

  const handleReopen = useCallback((id: string) => {
    console.log("Frontend: Triggering reopen for ID:", id);
    const formData = new FormData();
    formData.append("intent", "reopen");
    formData.append("id", id);
    fetcher.submit(formData, { method: "POST", action: "?index" });
    setActiveException(null);
  }, [fetcher]);

  const handleModalClose = useCallback(() => {
    setActiveException(null);
  }, []);

  const handleTabChange = useCallback((selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setQueryValue(value);
    setCurrentPage(1);
  }, []);


  const filteredExceptions = exceptions.filter((ex) => {
    const statusMatch = selectedTab === 0 ? ex.status === "OPEN" : ex.status === "RESOLVED";
    if (!statusMatch) return false;

    if (queryValue) {
      const q = queryValue.toLowerCase();
      const orderMatch = ex.orderName.toLowerCase().includes(q);
      const skuMatch = (ex.sku || "").toLowerCase().includes(q);
      if (!orderMatch && !skuMatch) return false;
    }

    if (minExposure && !isNaN(Number(minExposure))) {
      if (Number(ex.estimatedExposure) < Number(minExposure)) return false;
    }

    return true;
  });

  filteredExceptions.sort((a, b) => {
    const sort = sortSelected[0] as string;
    if (sort === "date desc") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (sort === "date asc") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sort === "exposure desc") {
      return Number(b.estimatedExposure) - Number(a.estimatedExposure);
    } else if (sort === "exposure asc") {
      return Number(a.estimatedExposure) - Number(b.estimatedExposure);
    }
    return 0;
  });

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredExceptions.length / itemsPerPage);
  const paginatedExceptions = filteredExceptions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } =
    useIndexResourceState(paginatedExceptions);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success && fetcher.data.intent === "bulk_resolve") {
      clearSelection();
    }
  }, [fetcher.state, fetcher.data, clearSelection]);

  const handleBulkResolve = useCallback(() => {
    setIsBulkModalOpen(true);
  }, []);

  const handleExportCSV = useCallback(() => {
    const csvHeader = "Order,Issue,Item,Qty,Exposure,Age,Status\n";
    const csvRows = filteredExceptions.map(ex => {
      const ageInDays = Math.floor((new Date().getTime() - new Date(ex.createdAt).getTime()) / (1000 * 3600 * 24));
      const displayItem = ex.itemName ? ex.itemName.replace(/"/g, '""') : (ex.sku || "Unknown Item");
      return `"${ex.orderName}","Missing Return","${displayItem}",${ex.discrepancyQuantity},${ex.estimatedExposure},${ageInDays},${ex.status}`;
    });
    const csvString = csvHeader + csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const tabName = selectedTab === 0 ? 'ActionRequired' : 'AuditHistory';
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `DearRecon_${tabName}_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredExceptions, selectedTab]);


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
      <IndexTable.Row
        id={ex.id}
        key={ex.id}
        position={index}
        selected={selectedResources.includes(ex.id)}
      >
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
            {ex.itemName || ex.sku || "Unknown Item"}
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
    <Frame>
      <Page
      title="DearRecon"
      subtitle="Refund & Return Reconciliation"
      primaryAction={{
        content: isCooldownActive ? `Next scan available in ${formatTime(remainingTime)}` : "Run Daily Scan",
        onAction: handleRunScan,
        disabled: isCooldownActive,
        loading: isSyncing,
      }}
      secondaryActions={[
        {
          content: planType === "FREE" ? "Export to CSV (Pro)" : "Export to CSV",
          disabled: planType === "FREE",
          onAction: handleExportCSV
        },
        ...(planType === "FREE" ? [{ content: "Upgrade to Pro", onAction: () => navigate("/app/pricing" + location.search) }] : [])
      ]}
    >
      <BlockStack gap="400">
        {showBanner && (
          <OnboardingBanner onDismiss={() => setShowBanner(false)} />
        )}

        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              {/* Top Metrics Cards */}
              <MetricsOverview
                openExceptionsCount={openExceptionsCount}
                formattedTotalExposure={formattedTotalExposure}
                missingItems={missingItems}
              />

              {/* Exception Table */}
              <Card padding="0">
                <IndexFilters
                  sortOptions={[
                    { label: 'Date', value: 'date asc', directionLabel: 'Oldest' },
                    { label: 'Date', value: 'date desc', directionLabel: 'Newest' },
                    { label: 'Exposure', value: 'exposure asc', directionLabel: 'Lowest' },
                    { label: 'Exposure', value: 'exposure desc', directionLabel: 'Highest' }
                  ]}
                  sortSelected={sortSelected}
                  queryValue={queryValue}
                  queryPlaceholder="Search by order ID or SKU"
                  onQueryChange={handleSearchChange}
                  onQueryClear={() => handleSearchChange('')}
                  onSort={setSortSelected}
                  cancelAction={{
                    onAction: handleClearAll,
                    disabled: false,
                    loading: false,
                  }}
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
                  canCreateNewView={false}
                  filters={[
                    {
                      key: 'minExposure',
                      label: 'Minimum Exposure ($)',
                      filter: (
                        <TextField
                          label="Minimum Exposure ($)"
                          value={minExposure}
                          onChange={setMinExposure}
                          autoComplete="off"
                          labelHidden
                          type="number"
                        />
                      ),
                      shortcut: true,
                    },
                  ]}
                  appliedFilters={appliedFilters}
                  onClearAll={handleClearAll}
                  mode={mode}
                  setMode={setMode}
                />
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
                        selectable={selectedTab === 0}
                        selectedItemsCount={
                          allResourcesSelected ? 'All' : selectedResources.length
                        }
                        onSelectionChange={handleSelectionChange}
                        promotedBulkActions={[
                          {
                            content: 'Mark as resolved (Bulk)',
                            onAction: handleBulkResolve,
                          },
                        ]}
                        headings={[
                          { title: "Order" },
                          { title: "Issue" },
                          { title: "Item" },
                          { title: "Qty" },
                          { title: "Exposure", alignment: "end" },
                          { title: "Age" },
                          { title: "Status" },
                          { title: "" },
                        ]}
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
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>

      <ExceptionDetailModal
        activeException={activeException}
        onClose={handleModalClose}
        onResolve={handleResolveSubmit}
        onReopen={handleReopen}
        isResolving={isResolving}
      />

      <BulkResolveModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        selectedIds={selectedResources as string[]}
        isResolving={isResolving}
        fetcher={fetcher}
      />
    </Page>
    </Frame>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  const boundHeaders = boundary.headers(headersArgs);
  const newHeaders = new Headers(boundHeaders);
  newHeaders.set("Cache-Control", "private, max-age=10, stale-while-revalidate=59");
  return newHeaders;
};