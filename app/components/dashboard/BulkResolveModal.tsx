import { useState } from "react";
import { Modal, Select, TextField, BlockStack } from "@shopify/polaris";

interface BulkResolveModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  isResolving: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetcher: any;
}

export function BulkResolveModal({
  isOpen,
  onClose,
  selectedIds,
  isResolving,
  fetcher,
}: BulkResolveModalProps) {
  const [bulkReason, setBulkReason] = useState("Restocked");
  const [customReason, setCustomReason] = useState("");

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Resolve Multiple Exceptions"
      primaryAction={{
        content: "Resolve",
        onAction: () => {
          const formData = new FormData();
          formData.append("intent", "bulk_resolve");
          formData.append("ids", JSON.stringify(selectedIds));

          // Determine the final reason string to send to the database
          const finalReason =
            bulkReason === "Other" && customReason.trim() !== ""
              ? customReason
              : bulkReason;

          formData.append("bulkReason", finalReason);
          fetcher.submit(formData, { method: "POST", action: "?index" });
          onClose();
        },
        loading: isResolving,
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Select
            label="Resolution Reason"
            options={[
              { label: "Restocked", value: "Restocked" },
              { label: "Manual adjustment", value: "Manual adjustment" },
              { label: "False positive", value: "False positive" },
              { label: "Other", value: "Other" },
            ]}
            value={bulkReason}
            onChange={setBulkReason}
          />
          {bulkReason === "Other" && (
            <TextField
              label="Custom Reason"
              value={customReason}
              onChange={setCustomReason}
              autoComplete="off"
              maxLength={25}
              showCharacterCount
            />
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}