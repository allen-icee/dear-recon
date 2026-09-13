import { Grid, Card, BlockStack, Text } from "@shopify/polaris";

interface MetricsOverviewProps {
  openExceptionsCount: number;
  formattedTotalExposure: string;
  missingItems: number;
}

export function MetricsOverview({
  openExceptionsCount,
  formattedTotalExposure,
  missingItems,
}: MetricsOverviewProps) {
  return (
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
  );
}
