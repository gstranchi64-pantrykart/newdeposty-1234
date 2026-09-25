# PantryMaster ERP - Grocery & Inventory Management System

A production-ready Grocery E-Commerce, Batch-wise Inventory, Customer Pantry Card credit system, Quick Order COD, Delivery tracking, and Auditor Field Verification platform.

---

## 🚀 Key Features

### 1. 📦 Stock & Batch Master (Inventory Management)
- **Batch-wise Inventory**: Real-time batch stock tracking with expiry dates, manufacturing dates, and automated low-stock alerts.
- **Stock In & Inward Entry**: Purchase stock registration, MRP, cost price, selling price, and barcode ID generation.
- **Master Product Catalog**: Comprehensive product catalog with multi-angle image previews, category aisle filtering, and stock eligibility controls.

### 2. 🚚 Orders & Delivery Operations
- **Dual-Track Fulfillment**: Support for both Pantry Card Credit orders and Quick COD (Cash on Delivery) orders.
- **Warehouse Packing Slips**: Batch-wise item picking, packing slip generation, and verification barcodes.
- **Delivery Boy Management**: Real-time route assignment, delivery confirmation, and cash reconciliation.

### 3. 💳 Pantry Card & Customer Financials
- **Pantry Card System**: Credit-based pantry ordering system with real-time credit limit validation.
- **Pantry Pay & Wallet**: In-app customer passbook, wallet recharges, credit ledger, and payment approvals.
- **Live Customer Pantry Holdings**: Real-time monitoring of items stocked at customer locations with consumption history.

### 4. 🔍 Auditor Field Verification
- **On-Site Physical Audit**: Field audit verification for customer pantry holdings.
- **Audit Bill Locking**: Discrepancy reporting, bill generation, and customer locking workflow.
- **Auditor Return Claims**: Return item processing and audit trail reports.

### 5. 📱 Fully Responsive Multi-Panel UI
- **Customer Panel**: Mobile-first design optimized for Android & iOS smartphones with bottom navigation.
- **Admin Panel**: Full desktop/laptop wide layout with categorized menu headers.
- **Auditor Panel**: Touch-friendly interface optimized for 5-inch tablets and mobile devices.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Recharts, Motion
- **Backend**: Node.js, Express, TSX, Supabase JS
- **Build Tool**: Vite, ESBuild
- **PDF & Canvas**: jsPDF, html2canvas

---

## 🏃 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or bun

### Installation

1. Clone or download the repository:
   ```bash
   git clone <repository-url>
   cd <project-folder>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env` and fill in your Supabase or service credentials:
   ```bash
   cp .env.example .env
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. Build for production:
   ```bash
   npm run build
   ```

6. Start production server:
   ```bash
   npm start
   ```

---

## 📂 Project Structure

```
├── data/                  # Mock/local database state
├── server/                # Backend business logic & Supabase configuration
│   ├── businessLogic.ts   # Core business rules, FIFO batch allocation, etc.
│   ├── store.ts           # In-memory / persistent datastore
│   └── supabase.ts        # Supabase client integration
├── src/
│   ├── components/
│   │   ├── admin/         # Admin ERP dashboard, batch inventory, orders, catalog
│   │   ├── auditor/       # Field auditor portal & PDF audit reports
│   │   ├── auth/          # Mobile OTP login & role management
│   │   ├── common/        # Reusable modals, status badges, navbar
│   │   ├── customer/      # Storefront, pantry cart, quick cart, profile
│   │   └── delivery/      # Delivery boy dispatch & cash collection portal
│   ├── context/           # AuthContext & global state
│   ├── services/          # API service endpoints
│   ├── utils/             # Date-time helpers, PDF generator, pantry helpers
│   ├── types.ts           # TypeScript interfaces & domain types
│   ├── App.tsx            # Main application root & view router
│   └── main.tsx           # React DOM entry point
├── server.ts              # Express application server
└── package.json           # Dependencies and scripts
```

---

## 📄 License
Private & Proprietary. All rights reserved.
