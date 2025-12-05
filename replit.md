# WooCommerce Order Reports Dashboard

## Overview

This project provides a professional analytics and reporting dashboard for WooCommerce store owners. It offers comprehensive order analysis, real-time data visualization, detailed order management, and raw materials inventory tracking. The system aims to enhance business decision-making by providing insights into sales performance, inventory levels, and order fulfillment processes. Key capabilities include custom order status support, secure credential management, dark mode, CSV export functionality, and username/password authentication for secure access.

## Authentication

- **Username/Password Login**: Secure authentication system to protect the dashboard
  - Register new account with username and password (minimum 6 characters)
  - Password hashing using scrypt algorithm with random salt
  - Session-based authentication with PostgreSQL session store
  - All API routes protected - require authentication to access
  - Secure session cookies with 7-day expiration
  - Logout properly destroys session and clears cookies

## User Preferences

- **Credentials**: Securely stored in PostgreSQL database with AES-256-GCM encryption
  - Store URL, Consumer Key, and Consumer Secret encrypted at rest
  - Key derived from SESSION_SECRET using scrypt algorithm
  - Frontend only checks credential status (configured: true/false)
  - Credentials never exposed to browser after initial save
  - Can be updated or deleted anytime via Settings page

- **Theme Preference**: Persisted in localStorage as `wc-reports-theme`
  - Supports light and dark modes
  - Automatically applied on page load

## System Architecture

The application is built with a React frontend and a Node.js/Express backend.

### UI/UX Decisions
- **Design System**: Professional aesthetic with blue primary color (`hsl(217 91% 35%)`) for trust and reliability.
- **Typography**: IBM Plex Sans font with a hierarchical sizing structure.
- **Currency**: All monetary values consistently displayed in Euros (€) with two decimal places.
- **Spacing**: Consistent 4/6/8/12 unit system for padding and gaps.
- **Theming**: Dark mode support with persistence via local storage, smooth transitions, and optimized color contrast.

### Technical Implementations
- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI, Recharts for data visualization, and TanStack Query for state management.
- **Backend**: Node.js with Express framework, interacting with the WooCommerce REST API and a PostgreSQL database.
- **Database**: PostgreSQL with Drizzle ORM for persistent storage of inventory data, material mappings, encrypted credentials, and local raw materials.
- **Credential Management**: WooCommerce API credentials are encrypted using AES-256-GCM with scrypt key derivation and stored securely in the database.
- **Order Statuses**: Dynamic detection and display of all WooCommerce custom order statuses, with smart color-coding. Internal statuses like "checkout-draft" (incomplete checkout sessions) are automatically excluded from the orders list and all calculations.
- **Inventory Tracking**: 
  - **Local PostgreSQL Storage**: All raw materials data fully migrated to local PostgreSQL database (tables: `local_raw_materials`, `local_raw_material_variations`)
  - Support for both simple and variable products with expandable table UI
  - Variation-specific stock tracking with attribute display
  - Product-material mappings with bulk mapping capabilities
  - Mapping management UI with inline editing
  - Comprehensive stock ledger with material_variation_id support
  - All stock operations (order processing, purchase order receiving, stock take, manual adjustments) update local PostgreSQL directly
  - WooCommerce product IDs preserved as local material IDs for compatibility with existing mappings, ledger entries, and purchase orders
  - One-time import endpoint (`POST /api/local-materials/import-from-woocommerce`) to migrate materials from WooCommerce
  - **ID Normalization**: Fulfillment status calculations normalize both local IDs and WooCommerce IDs to canonical local IDs, preventing double-counting when mappings reference the same material with different ID systems
- **Data Export**: Server-side CSV generation with filter support.

### Feature Specifications
- **Analytics Dashboard**: Displays key metrics (revenue, orders, AOV, total taxes, pending orders) and interactive charts for trends and status distribution.
- **Orders Management**: Filterable, searchable, and responsive orders table with detailed order views including product variations (size, color, frame type, etc.) displayed in the order details modal.
- **Inventory Processing**: Manual stock deduction from raw materials based on processed orders and product mappings.
- **Stock Ledger**: Detailed transaction history for all inventory changes.
- **Stock Take Feature**: Allows setting absolute stock levels during physical counts, with detailed logging and preview of changes.
- **Purchase Order System**: Complete PO management with the following capabilities:
  - Supplier management with contact details and active status tracking
  - Create purchase orders with line items, VAT rates (0%, 13.5%, 23%), and shipping costs
  - Shipping VAT tracking with separate rate configuration and calculated VAT amounts
  - Draft PO editing: add/remove line items and update shipping details before ordering
  - Status workflow: Draft → Ordered → Partially Received → Received (or Cancelled)
  - Checkbox-based receiving workflow for marking items as received when they arrive
  - PDF generation and download for purchase orders
  - Automatic stock updates when items are received (creates stock ledger entries)
- **Customers Management**: Complete customer management with the following capabilities:
  - Searchable customer list with sortable columns (name, email, country, orders, total spent)
  - Customer details modal showing contact info, billing/shipping addresses, order summary
  - Order history display for each customer with status badges
  - Average order value calculation
  - Uses WooCommerce's native customer data with accurate order counts and total spent

## External Dependencies

- **WooCommerce REST API**: Primary integration for fetching order data, customer data, and managing order statuses. Raw materials stock is managed locally in PostgreSQL.
- **PostgreSQL**: Relational database used for storing encrypted WooCommerce credentials, material product mappings, stock ledger entries, processed order information, local raw materials, and purchase orders.
- **Recharts**: JavaScript charting library for interactive data visualizations on the dashboard.
- **Shadcn UI**: UI component library for building accessible and customizable user interfaces.