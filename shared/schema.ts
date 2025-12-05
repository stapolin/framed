import { z } from "zod";
import { pgTable, serial, integer, varchar, timestamp, text, boolean, numeric, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// Database Tables

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// WooCommerce API credentials (encrypted at rest)
export const wooCommerceCredentials = pgTable("woocommerce_credentials", {
  id: serial("id").primaryKey(),
  storeUrl: varchar("store_url", { length: 500 }).notNull(),
  consumerKey: text("consumer_key").notNull(), // Encrypted
  consumerSecret: text("consumer_secret").notNull(), // Encrypted
  isActive: boolean("is_active").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWooCommerceCredentialsSchema = createInsertSchema(wooCommerceCredentials).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
});

export type InsertWooCommerceCredentials = z.infer<typeof insertWooCommerceCredentialsSchema>;
export type WooCommerceCredentials = typeof wooCommerceCredentials.$inferSelect;

// Maps product variations to raw materials they consume
export const materialProductMappings = pgTable("material_product_mappings", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(), // WooCommerce product ID (parent product being sold)
  variationId: integer("variation_id"), // WooCommerce variation ID of product being sold (null if simple)
  materialProductId: integer("material_product_id").notNull(), // Raw material product ID in WooCommerce
  materialVariationId: integer("material_variation_id"), // Raw material variation ID (null if simple material)
  quantityUsed: integer("quantity_used").notNull().default(1), // How many of this material per product
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Prevent duplicate mappings for the same material-product combination
  uniqueMapping: uniqueIndex("unique_material_product_mapping").on(
    table.materialProductId,
    table.materialVariationId,
    table.productId,
    table.variationId
  ),
}));

export const insertMaterialProductMappingSchema = createInsertSchema(materialProductMappings).omit({
  id: true,
  createdAt: true,
});

export type InsertMaterialProductMapping = z.infer<typeof insertMaterialProductMappingSchema>;
export type MaterialProductMapping = typeof materialProductMappings.$inferSelect;

// Stock ledger for tracking all inventory changes
export const stockLedger = pgTable("stock_ledger", {
  id: serial("id").primaryKey(),
  materialProductId: integer("material_product_id").notNull(), // Raw material product ID (parent for variations)
  materialVariationId: integer("material_variation_id"), // Variation ID (null for simple products)
  orderId: integer("order_id"), // WooCommerce order ID (null for manual adjustments)
  orderNumber: varchar("order_number", { length: 50 }), // Order number for display
  quantityChange: integer("quantity_change").notNull(), // Positive for restocks, negative for usage
  previousStock: integer("previous_stock"), // Stock level before change
  newStock: integer("new_stock"), // Stock level after change
  reason: varchar("reason", { length: 255 }).notNull(), // "order", "refund", "manual", "reconciliation"
  notes: text("notes"), // Additional notes
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStockLedgerSchema = createInsertSchema(stockLedger).omit({
  id: true,
  createdAt: true,
});

export type InsertStockLedger = z.infer<typeof insertStockLedgerSchema>;
export type StockLedgerEntry = typeof stockLedger.$inferSelect;

// Tracks which orders have had their inventory processed
export const processedOrders = pgTable("processed_orders", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().unique(),
  orderNumber: varchar("order_number", { length: 50 }),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProcessedOrderSchema = createInsertSchema(processedOrders).omit({
  id: true,
  processedAt: true,
  createdAt: true,
});

export type InsertProcessedOrder = z.infer<typeof insertProcessedOrderSchema>;
export type ProcessedOrder = typeof processedOrders.$inferSelect;

// Zod Schemas for WooCommerce API responses

export const orderSchema = z.object({
  id: z.number(),
  number: z.string(),
  status: z.string(),
  currency: z.string(),
  total: z.string(),
  total_tax: z.string(),
  shipping_total: z.string().optional(),
  discount_total: z.string().optional(),
  date_created: z.string(),
  date_modified: z.string(),
  payment_method_title: z.string().optional(),
  billing: z.object({
    first_name: z.string(),
    last_name: z.string(),
    email: z.string(),
    phone: z.string().optional(),
    address_1: z.string().optional(),
    address_2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postcode: z.string().optional(),
    country: z.string().optional(),
  }),
  shipping: z.object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    address_1: z.string().optional(),
    address_2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postcode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  line_items: z.array(z.object({
    id: z.number(),
    name: z.string(),
    product_id: z.number(),
    variation_id: z.number().optional(),
    quantity: z.number(),
    total: z.string(),
    subtotal: z.string().optional(),
    price: z.number().optional(),
    sku: z.string().optional(),
    meta_data: z.array(z.object({
      id: z.number(),
      key: z.string(),
      value: z.any(),
      display_key: z.string().optional(),
      display_value: z.string().optional(),
    })).optional(),
  })),
  shipping_lines: z.array(z.object({
    id: z.number(),
    method_title: z.string(),
    total: z.string(),
  })).optional(),
  meta_data: z.array(z.object({
    id: z.number(),
    key: z.string(),
    value: z.any(),
  })).optional(),
});

export type Order = z.infer<typeof orderSchema>;

export const orderStatusSchema = z.object({
  slug: z.string(),
  name: z.string(),
  total: z.number(),
});

export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const dashboardMetricsSchema = z.object({
  totalRevenue: z.number(),
  totalOrders: z.number(),
  averageOrderValue: z.number(),
  ordersByStatus: z.record(z.string(), z.number()),
});

export type DashboardMetrics = z.infer<typeof dashboardMetricsSchema>;

export const orderTrendSchema = z.object({
  date: z.string(),
  orders: z.number(),
  revenue: z.number(),
});

export type OrderTrend = z.infer<typeof orderTrendSchema>;

export const wooCommerceConfigSchema = z.object({
  storeUrl: z.string().url("Please enter a valid URL"),
  consumerKey: z.string().min(1, "Consumer Key is required"),
  consumerSecret: z.string().min(1, "Consumer Secret is required"),
});

export type WooCommerceConfig = z.infer<typeof wooCommerceConfigSchema>;

export const dateRangePresets = [
  "today",
  "last7days",
  "last30days",
  "last90days",
  "custom"
] as const;

export type DateRangePreset = typeof dateRangePresets[number];

// Raw Material Variation schema (for variable products)
export const rawMaterialVariationSchema = z.object({
  id: z.number(),
  parentId: z.number(),
  name: z.string(), // Generated from attributes (e.g., "Black", "White - Large")
  sku: z.string().optional(),
  stock_quantity: z.number().nullable(),
  stock_status: z.string(),
  manage_stock: z.boolean(),
  attributes: z.array(z.object({
    id: z.number(),
    name: z.string(),
    option: z.string(),
  })),
});

export type RawMaterialVariation = z.infer<typeof rawMaterialVariationSchema>;

// Raw Material schema (from WooCommerce products in Raw Materials category)
export const rawMaterialSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.enum(["simple", "variable"]).default("simple"),
  sku: z.string().optional(),
  stock_quantity: z.number().nullable(), // For simple products, or total of variations for variable
  stock_status: z.string(),
  manage_stock: z.boolean(),
  categories: z.array(z.object({
    id: z.number(),
    name: z.string(),
    slug: z.string(),
  })),
  images: z.array(z.object({
    id: z.number(),
    src: z.string(),
  })).optional(),
  variations: z.array(rawMaterialVariationSchema).optional(), // For variable products
});

export type RawMaterial = z.infer<typeof rawMaterialSchema>;

// Variable product with variations
export const variableProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  sku: z.string().optional(),
  variations: z.array(z.number()).optional(), // variation IDs
});

export type VariableProduct = z.infer<typeof variableProductSchema>;

// Product variation
export const productVariationSchema = z.object({
  id: z.number(),
  sku: z.string().optional(),
  attributes: z.array(z.object({
    id: z.number(),
    name: z.string(),
    option: z.string(),
  })),
});

export type ProductVariation = z.infer<typeof productVariationSchema>;

// ============================================
// PURCHASE ORDER SYSTEM
// ============================================

// Purchase Order Status Enum
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "draft",
  "ordered",
  "partially_received",
  "received",
  "cancelled"
]);

// Suppliers table
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

// Purchase Orders table
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: varchar("po_number", { length: 50 }).notNull().unique(),
  supplierId: integer("supplier_id").notNull(),
  status: purchaseOrderStatusEnum("status").default("draft").notNull(),
  orderDate: timestamp("order_date"),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  receivedDate: timestamp("received_date"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).default("0").notNull(),
  shippingCost: numeric("shipping_cost", { precision: 10, scale: 2 }).default("0").notNull(),
  shippingVatRate: numeric("shipping_vat_rate", { precision: 5, scale: 2 }).default("0").notNull(),
  shippingVat: numeric("shipping_vat", { precision: 10, scale: 2 }).default("0").notNull(),
  vatTotal: numeric("vat_total", { precision: 10, scale: 2 }).default("0").notNull(),
  grandTotal: numeric("grand_total", { precision: 10, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;

// Purchase Order Items table
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").notNull(),
  materialProductId: integer("material_product_id").notNull(),
  materialVariationId: integer("material_variation_id"),
  materialName: varchar("material_name", { length: 500 }).notNull(),
  quantityOrdered: integer("quantity_ordered").notNull(),
  quantityReceived: integer("quantity_received").default(0).notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).default("23").notNull(),
  lineSubtotal: numeric("line_subtotal", { precision: 10, scale: 2 }).notNull(),
  lineVat: numeric("line_vat", { precision: 10, scale: 2 }).notNull(),
  lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
  createdAt: true,
});

export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;

// Relations
export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchaseOrders: many(purchaseOrders),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchaseOrders.supplierId],
    references: [suppliers.id],
  }),
  items: many(purchaseOrderItems),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
}));

// Zod schemas for API
export const purchaseOrderWithItemsSchema = z.object({
  id: z.number(),
  poNumber: z.string(),
  supplierId: z.number(),
  supplierName: z.string().optional(),
  status: z.enum(["draft", "ordered", "partially_received", "received", "cancelled"]),
  orderDate: z.string().nullable(),
  expectedDeliveryDate: z.string().nullable(),
  receivedDate: z.string().nullable(),
  subtotal: z.string(),
  shippingCost: z.string(),
  shippingVatRate: z.string(),
  shippingVat: z.string(),
  vatTotal: z.string(),
  grandTotal: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  items: z.array(z.object({
    id: z.number(),
    purchaseOrderId: z.number(),
    materialProductId: z.number(),
    materialVariationId: z.number().nullable(),
    materialName: z.string(),
    quantityOrdered: z.number(),
    quantityReceived: z.number(),
    unitPrice: z.string(),
    vatRate: z.string(),
    lineSubtotal: z.string(),
    lineVat: z.string(),
    lineTotal: z.string(),
  })),
});

export type PurchaseOrderWithItems = z.infer<typeof purchaseOrderWithItemsSchema>;

// Receive items request schema
export const receiveItemsRequestSchema = z.object({
  items: z.array(z.object({
    itemId: z.number(),
    quantityReceived: z.number().min(0),
  })),
});

export type ReceiveItemsRequest = z.infer<typeof receiveItemsRequestSchema>;

// ============================================
// LOCAL RAW MATERIALS SYSTEM
// ============================================

// Raw Materials table - stores materials locally instead of fetching from WooCommerce
export const rawMaterials = pgTable("raw_materials", {
  id: serial("id").primaryKey(),
  woocommerceId: integer("woocommerce_id"), // Original WooCommerce ID (for reference during import)
  name: varchar("name", { length: 500 }).notNull(),
  sku: varchar("sku", { length: 100 }),
  type: varchar("type", { length: 50 }).default("simple").notNull(), // "simple" or "variable"
  stockQuantity: integer("stock_quantity").default(0),
  manageStock: boolean("manage_stock").default(true).notNull(),
  lowStockThreshold: integer("low_stock_threshold").default(5),
  imageUrl: text("image_url"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRawMaterialSchema = createInsertSchema(rawMaterials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRawMaterial = z.infer<typeof insertRawMaterialSchema>;
export type LocalRawMaterial = typeof rawMaterials.$inferSelect;

// Raw Material Variations table - for variable materials
export const rawMaterialVariations = pgTable("raw_material_variations", {
  id: serial("id").primaryKey(),
  materialId: integer("material_id").notNull(), // References rawMaterials.id
  woocommerceId: integer("woocommerce_id"), // Original WooCommerce variation ID
  name: varchar("name", { length: 500 }).notNull(), // e.g., "Black", "White - Large"
  sku: varchar("sku", { length: 100 }),
  stockQuantity: integer("stock_quantity").default(0),
  manageStock: boolean("manage_stock").default(true).notNull(),
  lowStockThreshold: integer("low_stock_threshold").default(5),
  attributes: text("attributes"), // JSON string of attributes [{name: "Color", option: "Black"}]
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRawMaterialVariationSchema = createInsertSchema(rawMaterialVariations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRawMaterialVariation = z.infer<typeof insertRawMaterialVariationSchema>;
export type LocalRawMaterialVariation = typeof rawMaterialVariations.$inferSelect;

// Relations for local raw materials
export const rawMaterialsRelations = relations(rawMaterials, ({ many }) => ({
  variations: many(rawMaterialVariations),
}));

export const rawMaterialVariationsRelations = relations(rawMaterialVariations, ({ one }) => ({
  material: one(rawMaterials, {
    fields: [rawMaterialVariations.materialId],
    references: [rawMaterials.id],
  }),
}));

// Type for material with variations (for API responses)
export type LocalRawMaterialWithVariations = LocalRawMaterial & {
  variations?: LocalRawMaterialVariation[];
};
