import { useState, useEffect } from "react";
import { BlockStack, Text, Grid, Button, ChoiceList, InlineStack, Box, Modal, TextField } from "@shopify/polaris";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

export interface ExceptionUI {
  id: string;
  shop: string;
  orderId: string;
  orderName: string;
  itemName: string | null;
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
  resolvedAt: string | null;
  [key: string]: unknown;
}

interface ExceptionDetailModalProps {
  activeException: ExceptionUI | null;
  onClose: () => void;
  onResolve: (exceptionId: string, reason: string) => void;
  onReopen?: (exceptionId: string) => void;
  isResolving: boolean;
}

export function ExceptionDetailModal({
  activeException,
  onClose,
  onResolve,
  onReopen,
  isResolving,
}: ExceptionDetailModalProps) {
  const [resolutionReason, setResolutionReason] = useState<string[]>(["Restocked"]);
  const [customReason, setCustomReason] = useState("");
  const fetcher = useFetcher<any>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success) {
      shopify.toast.show(fetcher.data.intent === 'resolve' ? 'Exception resolved' : 'Exception reopened');
      const modal = document.getElementById('exception-detail-modal') as any;
      modal?.hide();
      onClose();
    }
  }, [fetcher.state, fetcher.data]);

  const handleResolveSubmit = () => {
    if (activeException) {
      const reasonToSubmit = resolutionReason[0] === 'Other' ? customReason : resolutionReason[0];
      fetcher.submit(
        { 
          intent: 'resolve', 
          exceptionId: activeException.id, 
          resolutionReason: reasonToSubmit 
        }, 
        { method: 'post', action: '?index' }
      );
    }
  };

  return (
    <Modal onClose={onClose} open={!!activeException} title="Exception Details">
      <Modal.Section>
        <div style={{ padding: '16px' }}>
        {activeException && (
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text variant="headingMd" as="h3">
                What Happened
              </Text>
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="span" tone="subdued">Item Name</Text>
                    <Text as="span" fontWeight="bold">{activeException.itemName || "Unknown Item"}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" tone="subdued">SKU</Text>
                    <Text as="span" fontWeight="bold">{activeException.sku || "N/A"}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" tone="subdued">Refunded Quantity</Text>
                    <Text as="span" fontWeight="bold">{activeException.refundQuantity}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" tone="subdued">Returned/Restocked Quantity</Text>
                    <Text as="span" fontWeight="bold">{activeException.returnQuantity}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" tone="subdued">Missing Reconciliation</Text>
                    <Text as="span" tone="critical" fontWeight="bold">{activeException.discrepancyQuantity}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" tone="subdued">Total Financial Exposure</Text>
                    <Text as="span" fontWeight="bold">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: activeException.currencyCode,
                      }).format(Number(activeException.estimatedExposure))}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Box>
            </BlockStack>

            {activeException.status === "OPEN" ? (
              <BlockStack gap="400">
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
                {resolutionReason[0] === "Other" && (
                  <TextField
                    label="Specify Reason"
                    value={customReason}
                    onChange={setCustomReason}
                    maxLength={25}
                    showCharacterCount
                    autoComplete="off"
                  />
                )}
              </BlockStack>
            ) : (
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">
                  Resolution Details
                </Text>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" tone="subdued">Resolved By</Text>
                      <Text as="span" fontWeight="bold">{activeException.resolvedBy || "System"}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" tone="subdued">Reason</Text>
                      <Text as="span" fontWeight="bold">{activeException.resolutionReason || ""}</Text>
                    </InlineStack>
                    {activeException.resolvedAt && (
                      <InlineStack align="space-between">
                        <Text as="span" tone="subdued">Date</Text>
                        <Text as="span" fontWeight="bold">{new Date(activeException.resolvedAt).toLocaleString()}</Text>
                      </InlineStack>
                    )}
                  </BlockStack>
                </Box>
              </BlockStack>
            )}

            <InlineStack align="end" gap="300">
              <Button
                url={`shopify:admin/orders/${activeException.orderId.split("/").pop()}`}
                external
              >
                Open Order in Shopify
              </Button>
              {activeException.status !== "OPEN" && onReopen && (
                <Button 
                  variant="primary"
                  tone="critical" 
                  onClick={() => {
                    fetcher.submit(
                      { intent: 'reopen', id: activeException.id }, 
                      { method: 'post', action: '?index' }
                    );
                  }}
                  loading={fetcher.state !== 'idle'}
                >
                  Reopen Exception
                </Button>
              )}
              {activeException.status === "OPEN" && (
                <Button variant="primary" onClick={handleResolveSubmit} loading={fetcher.state !== 'idle'}>
                  Submit Resolution
                </Button>
              )}
            </InlineStack>
          </BlockStack>
        )}
      </div>
      </Modal.Section>
    </Modal>
  );
}
