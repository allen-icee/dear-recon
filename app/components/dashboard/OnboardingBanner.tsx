import { Banner, Text } from "@shopify/polaris";

interface OnboardingBannerProps {
  onDismiss: () => void;
}

export function OnboardingBanner({ onDismiss }: OnboardingBannerProps) {
  return (
    <Banner
      title="How it works"
      tone="info"
      onDismiss={onDismiss}
    >
      <Text as="p">
        DearRecon automatically scans your store for refunds that haven't been restocked. 
        Click on any open exception to investigate the financial exposure, verify the details in Shopify, 
        and mark it as resolved once the inventory is corrected.
      </Text>
    </Banner>
  );
}
