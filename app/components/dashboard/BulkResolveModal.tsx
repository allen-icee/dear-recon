import { useState } from "react";
import { Modal, Select } from "@shopify/polaris";

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

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Resolve Multiple Exceptions"
      primaryAction={{
        content: 'Resolve',
        onAction: () => {
          const formData = new FormData();
          formData.append("intent", "bulk_resolve");
          formData.append("ids", JSON.stringify(selectedIds));
          formData.append("bulkReason", bulkReason);
          fetcher.submit(formData, { method: "POST", action: "?index" });
          onClose();
        },
        loading: isResolving,
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
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
      </Modal.Section>
    </Modal>
  );
}
