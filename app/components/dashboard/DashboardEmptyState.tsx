import { EmptyState, BlockStack, Text, Badge } from "@shopify/polaris";

interface DashboardEmptyStateProps {
  selectedTab: number;
  handleManualScan: () => void;
  isSyncing: boolean;
  cooldownRemaining: number;
  planType: string;
  isCooldownActive?: boolean;
}

export function DashboardEmptyState({
  selectedTab,
  handleManualScan,
  isSyncing,
  cooldownRemaining,
  planType,
  isCooldownActive
}: DashboardEmptyStateProps) {
  // Use the passed isCooldownActive if provided, otherwise compute it statically
  const cooldownActive = isCooldownActive ?? (planType === "FREE" && cooldownRemaining > 0);

  return (
    <EmptyState
      heading={selectedTab === 0 ? "Inbox Zero!" : "No history found"}
      action={selectedTab === 0 ? { 
        content: "Run Manual Scan", 
        onAction: handleManualScan,
        loading: isSyncing,
        disabled: cooldownActive
      } : undefined}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <BlockStack gap="200" inlineAlign="center">
        <Text as="p" variant="bodyMd">
          {selectedTab === 0 
            ? "You have no pending reconciliation issues. Great job keeping everything restocked!"
            : "There are no resolved reconciliation exceptions yet."}
        </Text>
        {selectedTab === 0 && <Badge tone="success">Real-time sync active</Badge>}
      </BlockStack>
    </EmptyState>
  );
}
