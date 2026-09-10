import { useState } from "react";
import { Modal, BlockStack, Text, Grid, Button, ChoiceList } from "@shopify/polaris";

export interface ExceptionUI {
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

interface ExceptionDetailModalProps {
  activeException: ExceptionUI | null;
  onClose: () => void;
  onResolve: (exceptionId: string, reason: string) => void;
  isResolving: boolean;
}

export function ExceptionDetailModal({
  activeException,
  onClose,
  onResolve,
  isResolving,
}: ExceptionDetailModalProps) {
  const [resolutionReason, setResolutionReason] = useState<string[]>(["Restocked"]);

  const handleResolveSubmit = () => {
    if (activeException) {
      onResolve(activeException.id, resolutionReason[0]);
    }
  };

  return (
    <Modal
      open={activeException !== null}
      onClose={onClose}
      title="Exception Details"
      primaryAction={
        activeException?.status === "OPEN"
          ? {
              content: "Submit Resolution",
              onAction: handleResolveSubmit,
              loading: isResolving,
            }
          : undefined
      }
      secondaryActions={[
        {
          content: "Close",
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
        {activeException && (
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text variant="headingMd" as="h3">
                What Happened
              </Text>
              <Grid>
                <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                  <Text variant="bodyMd" as="p" tone="subdued">Refunded Quantity:</Text>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                  <Text variant="bodyMd" as="p" fontWeight="bold">{activeException.refundQuantity}</Text>
                </Grid.Cell>
                
                <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                  <Text variant="bodyMd" as="p" tone="subdued">Returned/Restocked Quantity:</Text>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                  <Text variant="bodyMd" as="p" fontWeight="bold">{activeException.returnQuantity}</Text>
                </Grid.Cell>
                
                <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                  <Text variant="bodyMd" as="p" tone="subdued">Missing Reconciliation:</Text>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                  <Text variant="bodyMd" as="p" tone="critical" fontWeight="bold">{activeException.discrepancyQuantity}</Text>
                </Grid.Cell>
                
                <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                  <Text variant="bodyMd" as="p" tone="subdued">Total Financial Exposure:</Text>
                </Grid.Cell>
                <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                  <Text variant="bodyMd" as="p" fontWeight="bold">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: activeException.currencyCode,
                    }).format(Number(activeException.estimatedExposure))}
                  </Text>
                </Grid.Cell>
              </Grid>
            </BlockStack>

            <Button
              variant="primary"
              url={`shopify:admin/orders/${activeException.orderId.split("/").pop()}`}
              target="_parent"
            >
              Open Order in Shopify
            </Button>

            {activeException.status === "OPEN" ? (
              <ChoiceList
                title="Resolution Reason"
                choices={[
                  { label: "Restocked", value: "Restocked" },
                  { label: "Manual adjustment", value: "Manual adjustment" },
                  { label: "False positive", value: "False positive" },
                  { label: "Other", value: "Other" },
                ]}
                selected={resolutionReason}
                onChange={setResolutionReason}
              />
            ) : (
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">
                  Resolution Details
                </Text>
                <Text variant="bodyMd" as="p">
                  Resolved By: {activeException.resolvedBy || "System"}
                </Text>
                <Text variant="bodyMd" as="p">
                  Reason: {activeException.resolutionReason}
                </Text>
              </BlockStack>
            )}
          </BlockStack>
        )}
      </Modal.Section>
    </Modal>
  );
}
