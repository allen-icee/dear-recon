DearRecon — Product Requirements
Product Name

DearRecon

Product Category

Shopify Admin operational reconciliation.

Target Customer

Small-to-medium Shopify merchants.

Business Model

Recurring SaaS subscription.

Initial minimum price:

$9/month

Higher tiers may be introduced after validating actual merchant usage and data volume.

Core Problem

Shopify records orders, refunds, returns, and inventory states, but merchants may still need to manually reconcile whether refunded products were actually processed back into inventory.

DearRecon converts those underlying records into a daily exception queue.

Core Value Proposition

Find refund and return discrepancies before they become hidden inventory losses.

MVP

The MVP must:

Authenticate the Shopify merchant.
Retrieve relevant Shopify order, refund, return, and inventory data.
Reconcile refund quantities against relevant return quantities and processing state.
Calculate potential inventory cost exposure where documented Shopify data allows it.
Rank exceptions by financial exposure and severity.
Display exceptions in Shopify Admin.
Allow merchants to mark DearRecon exceptions as reviewed/resolved.
Persist application-specific data in Prisma.
Non-Goals

The MVP must NOT:

process refunds
process returns
modify Shopify inventory
modify Shopify orders
modify Shopify products
modify payments
provide customer return portals
modify storefront themes
modify checkout
integrate shipping carriers
integrate Meta
integrate Google Ads
integrate TikTok
integrate external analytics
provide customer-facing UI
Primary Daily Metric

Open reconciliation exceptions requiring merchant review.

Primary Financial Metric

Estimated inventory cost exposure caused by unresolved discrepancies.

Core User Workflow
Merchant opens DearRecon
        ↓
Daily reconciliation is displayed
        ↓
Exceptions are ranked
        ↓
Merchant opens an exception
        ↓
Merchant sees:
- order
- product
- quantity
- refund state
- return state
- processed quantity
- unit cost where available
- estimated exposure
        ↓
Merchant opens corresponding Shopify Admin record
        ↓
Merchant investigates
        ↓
Merchant marks DearRecon exception resolved
Product Principle

DearRecon does not need to replace Shopify Admin.

DearRecon exists to answer:

"What Shopify records need my attention this morning?"

Shopify remains responsible for actual merchant operations.

MVP Success Criteria

The first usable version should allow a merchant to answer within seconds:

How many reconciliation exceptions do I have?
Which exceptions are most financially important?
Which Shopify order/product is involved?
What caused the exception?
How much inventory cost may be exposed?
Which cases have already been reviewed?
