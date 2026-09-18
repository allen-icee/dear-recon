# dear-recon
dear-recon is an inventory reconciliation Shopify app built with Remix, React, and Prisma. It scans a merchant's store via GraphQL to find discrepancies between refunded items and returned items, catching issues like when a customer gets their money back but the item wasn't restocked.

## ✨ Features
- **Automated Exception Detection:** Scans store orders via GraphQL to find mismatches between refunds and returned items.
- **Protected Customer Data Access:** Safely leverages `read_orders` and `read_returns` scopes to access essential data.
- **Polaris UI Dashboard:** Clean, intuitive interface for merchants to view, manage, and resolve inventory exceptions.
- **Seamless OAuth Integration:** Quick and secure installation process using Shopify's robust authentication.
- **Robust Data Storage:** Uses PostgreSQL & Prisma for reliable, production-ready data storage to track scan history and resolved discrepancies.

## Languages & Tools (⌐■_■)
- ![Shopify](https://img.shields.io/badge/Shopify-95BF47?style=for-the-badge&logo=shopify&logoColor=white)
- ![Remix](https://img.shields.io/badge/remix-%23000.svg?style=for-the-badge&logo=remix&logoColor=white)
- ![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
- ![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
- ![PostgreSQL](https://img.shields.io/badge/postgresql-4169e1?style=for-the-badge&logo=postgresql&logoColor=white)

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/)
- [Shopify Partner Account](https://partners.shopify.com/)

### Installation

```bash
npm install
```

Set up your environment variables based on standard Shopify CLI variables. Ensure you have the following configured in your environment or `.env` file:
```
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
DATABASE_URL=postgresql://user:password@localhost:5432/dear_recon
DIRECT_URL=postgresql://user:password@localhost:5432/dear_recon
```

Push the database schema using Prisma:
```bash
npx prisma db push
```

### Run

```bash
npm run dev
```

## 📄 License
Copyright (c) 2026 Allen Icee Dequiros

This project is shared for portfolio, educational, and learning purposes.
You are welcome to study the codebase and use it as inspiration for your own projects.
Copying substantial portions of this project, redistributing it, submitting it as your own work, or creating direct clones is not permitted without explicit permission.
If this project inspires your work, please build your own implementation rather than copying the source code.
All rights reserved.
