DearRecon — Project AI Instructions

These instructions apply ONLY to the DearRecon project.

General Shopify engineering rules are located in:

D:/Projects/shopify-workspace/docs/

Before coding, read the relevant general documentation and this project documentation.

Product

Application name:

DearRecon

Purpose:

DearRecon is a Shopify Admin application that helps merchants reconcile refunds and returns against inventory outcomes and identify potential inventory cost exposure.

MVP Architecture

DearRecon MVP is:

Shopify Admin only
Embedded in Shopify Admin
Read-only
GraphQL Admin API only
No external APIs
No storefront code
No checkout code
No theme modification
No customer-facing application
No payment processing
No refund processing
No inventory mutation
No order mutation

If the application becomes unavailable, Shopify storefront sales and checkout must remain unaffected.

Data Source

Shopify is the source of truth.

Prisma is used only for application persistence, derived calculations, snapshots, merchant configuration, exception state, and synchronization metadata.

Never treat Prisma as the authoritative source for Shopify commerce data.

Financial Calculations

DearRecon performs financial calculations.

Never use unsafe floating-point arithmetic for monetary calculations.

Use decimal-safe arithmetic.

Never assume USD.

Always preserve the applicable Shopify currency.

All financial formulas must be documented before implementation.

Timezone

Merchant-facing dates such as:

today
yesterday
refund date
return age
unresolved duration

must use the merchant's Shopify store timezone.

Never use the server's local timezone for business-day calculations.

Shopify API

Only the Shopify Admin GraphQL API may be used.

Do not use the REST Admin API.

Every GraphQL object, field, argument, enum, and query must be verified against the exact API version configured for this project.

Never invent Shopify fields or APIs.

Access Scopes

Request the minimum scopes required for the actual DearRecon MVP.

Do not request write scopes unless a future feature explicitly requires them.

Do not request restricted scopes without documented justification.

Shopify Mutations

DearRecon MVP should not mutate Shopify commerce resources.

Do not:

create refunds
process returns
modify inventory
modify orders
modify payments
modify products

Merchant corrective actions should occur inside Shopify Admin.

A DearRecon "Resolve" action means only:

mark the DearRecon exception as reviewed/resolved in the application's own database.

It must not modify Shopify commerce data.

Storefront Isolation

DearRecon must not:

inject JavaScript into storefront themes
modify Liquid files
create storefront app embeds
create storefront app blocks
modify checkout
create checkout extensions
use Web Pixels

No customer-facing code is required for the MVP.

Billing

DearRecon is intended to be a paid recurring Shopify App Store application.

The commercial target begins at:

$9/month

Billing must use Shopify's supported native app billing/pricing system.

Do not implement off-platform billing.

Do not collect payment information directly.

Billing implementation will be added in a later phase.

Daily Product Habit

The product is designed around a daily merchant workflow.

The primary future workflow is:

Open DearRecon
↓
Review new reconciliation exceptions
↓
Investigate the highest-value discrepancies
↓
Open the corresponding Shopify Admin record
↓
Resolve the internal DearRecon exception

Do not turn the application into a generic analytics dashboard.

The product should prioritize exceptions and actions over large collections of passive charts.

GitHub

The repository is PRIVATE during development.

Never commit:

.env
secrets
access tokens
API credentials
private keys
production credentials

Verify .gitignore before creating commits.

AI Coding Behavior

Do not make speculative architecture changes.

Do not add dependencies without a reason.

Do not build future features prematurely.

Do not implement functionality merely because Shopify supports it.

Do not copy code blindly from old tutorials.

When uncertain:

inspect the current project
inspect installed versions
verify official Shopify documentation
make the smallest evidence-based change
report unresolved uncertainty

The AI agent must stop rather than invent an API or architecture.
