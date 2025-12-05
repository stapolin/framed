import { 
  materialProductMappings, 
  stockLedger,
  processedOrders,
  wooCommerceCredentials,
  suppliers,
  purchaseOrders,
  purchaseOrderItems,
  users,
  rawMaterials,
  rawMaterialVariations,
  type InsertMaterialProductMapping,
  type MaterialProductMapping,
  type InsertStockLedger,
  type StockLedgerEntry,
  type InsertProcessedOrder,
  type ProcessedOrder,
  type WooCommerceCredentials,
  type InsertSupplier,
  type Supplier,
  type InsertPurchaseOrder,
  type PurchaseOrder,
  type InsertPurchaseOrderItem,
  type PurchaseOrderItem,
  type InsertUser,
  type User,
  type InsertRawMaterial,
  type LocalRawMaterial,
  type InsertRawMaterialVariation,
  type LocalRawMaterialVariation,
  type LocalRawMaterialWithVariations,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, asc, or, ilike } from "drizzle-orm";
import { encrypt, decrypt } from "./encryption";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

export interface DecryptedCredentials {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface PurchaseOrderFilters {
  status?: string;
  supplierId?: number;
  search?: string;
}

export interface PurchaseOrderWithDetails extends PurchaseOrder {
  supplier?: Supplier;
  items: PurchaseOrderItem[];
}

export interface BulkMappingTarget {
  productId: number;
  variationId: number | null;
  quantityUsed: number;
}

export interface IStorage {
  // User authentication
  getUser(id: number): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  sessionStore: session.Store;

  getMaterialMappings(): Promise<MaterialProductMapping[]>;
  getMaterialMappingsForProduct(productId: number, variationId?: number): Promise<MaterialProductMapping[]>;
  getMaterialMappingsForMaterial(materialProductId: number, materialVariationId?: number | null): Promise<MaterialProductMapping[]>;
  createMaterialMapping(mapping: InsertMaterialProductMapping): Promise<MaterialProductMapping>;
  bulkCreateMaterialMappings(materialProductId: number, materialVariationId: number | null, targets: BulkMappingTarget[]): Promise<MaterialProductMapping[]>;
  updateMaterialMapping(id: number, quantityUsed: number): Promise<MaterialProductMapping | null>;
  deleteMaterialMapping(id: number): Promise<void>;
  
  getStockLedgerEntries(materialProductId?: number, limit?: number): Promise<StockLedgerEntry[]>;
  createStockLedgerEntry(entry: InsertStockLedger): Promise<StockLedgerEntry>;
  
  getProcessedOrder(orderId: number): Promise<ProcessedOrder | null>;
  getAllProcessedOrders(): Promise<ProcessedOrder[]>;
  markOrderProcessed(data: InsertProcessedOrder): Promise<ProcessedOrder>;
  
  getCredentials(): Promise<DecryptedCredentials | null>;
  hasCredentials(): Promise<boolean>;
  saveCredentials(storeUrl: string, consumerKey: string, consumerSecret: string): Promise<void>;
  deleteCredentials(): Promise<void>;

  // Suppliers
  getSuppliers(activeOnly?: boolean): Promise<Supplier[]>;
  getSupplier(id: number): Promise<Supplier | null>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier | null>;
  deleteSupplier(id: number): Promise<void>;

  // Purchase Orders
  getPurchaseOrders(filters?: PurchaseOrderFilters): Promise<PurchaseOrderWithDetails[]>;
  getPurchaseOrder(id: number): Promise<PurchaseOrderWithDetails | null>;
  getNextPONumber(): Promise<string>;
  createPurchaseOrder(po: InsertPurchaseOrder, items: InsertPurchaseOrderItem[]): Promise<PurchaseOrderWithDetails>;
  updatePurchaseOrder(id: number, po: Partial<InsertPurchaseOrder>, items?: InsertPurchaseOrderItem[]): Promise<PurchaseOrderWithDetails | null>;
  deletePurchaseOrder(id: number): Promise<void>;
  
  // Purchase Order Items
  getPurchaseOrderItems(purchaseOrderId: number): Promise<PurchaseOrderItem[]>;
  addPurchaseOrderItem(purchaseOrderId: number, item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
  updatePurchaseOrderItem(id: number, data: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem | null>;
  deletePurchaseOrderItem(id: number): Promise<void>;
  receivePurchaseOrderItems(purchaseOrderId: number, itemReceipts: { itemId: number; quantityReceived: number }[]): Promise<PurchaseOrderWithDetails>;
  recalculatePurchaseOrderTotals(purchaseOrderId: number): Promise<PurchaseOrderWithDetails | null>;

  // Local Raw Materials
  getLocalRawMaterials(activeOnly?: boolean): Promise<LocalRawMaterialWithVariations[]>;
  getLocalRawMaterial(id: number): Promise<LocalRawMaterialWithVariations | null>;
  getLocalRawMaterialByWooId(woocommerceId: number): Promise<LocalRawMaterial | null>;
  createLocalRawMaterial(material: InsertRawMaterial): Promise<LocalRawMaterial>;
  updateLocalRawMaterial(id: number, material: Partial<InsertRawMaterial>): Promise<LocalRawMaterial | null>;
  deleteLocalRawMaterial(id: number): Promise<void>;
  updateLocalRawMaterialStock(id: number, newStock: number): Promise<LocalRawMaterial | null>;

  // Local Raw Material Variations
  getLocalRawMaterialVariations(materialId: number): Promise<LocalRawMaterialVariation[]>;
  getLocalRawMaterialVariation(id: number): Promise<LocalRawMaterialVariation | null>;
  getLocalRawMaterialVariationByWooId(woocommerceId: number): Promise<LocalRawMaterialVariation | null>;
  createLocalRawMaterialVariation(variation: InsertRawMaterialVariation): Promise<LocalRawMaterialVariation>;
  updateLocalRawMaterialVariation(id: number, variation: Partial<InsertRawMaterialVariation>): Promise<LocalRawMaterialVariation | null>;
  deleteLocalRawMaterialVariation(id: number): Promise<void>;
  updateLocalRawMaterialVariationStock(id: number, newStock: number): Promise<LocalRawMaterialVariation | null>;
}

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool: pool as any, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: number): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || null;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getMaterialMappings(): Promise<MaterialProductMapping[]> {
    return await db.select().from(materialProductMappings);
  }

  async getMaterialMappingsForProduct(productId: number, variationId?: number): Promise<MaterialProductMapping[]> {
    if (variationId) {
      return await db.select()
        .from(materialProductMappings)
        .where(
          and(
            eq(materialProductMappings.productId, productId),
            eq(materialProductMappings.variationId, variationId)
          )
        );
    }
    return await db.select()
      .from(materialProductMappings)
      .where(eq(materialProductMappings.productId, productId));
  }

  async getMaterialMappingsForMaterial(materialProductId: number, materialVariationId?: number | null): Promise<MaterialProductMapping[]> {
    if (materialVariationId !== undefined) {
      // Filter by both material product and variation
      if (materialVariationId === null) {
        return await db.select()
          .from(materialProductMappings)
          .where(
            and(
              eq(materialProductMappings.materialProductId, materialProductId),
              sql`${materialProductMappings.materialVariationId} IS NULL`
            )
          );
      }
      return await db.select()
        .from(materialProductMappings)
        .where(
          and(
            eq(materialProductMappings.materialProductId, materialProductId),
            eq(materialProductMappings.materialVariationId, materialVariationId)
          )
        );
    }
    // Just filter by material product ID
    return await db.select()
      .from(materialProductMappings)
      .where(eq(materialProductMappings.materialProductId, materialProductId));
  }

  async createMaterialMapping(mapping: InsertMaterialProductMapping): Promise<MaterialProductMapping> {
    const [result] = await db.insert(materialProductMappings)
      .values(mapping)
      .returning();
    return result;
  }

  async bulkCreateMaterialMappings(
    materialProductId: number, 
    materialVariationId: number | null, 
    targets: BulkMappingTarget[]
  ): Promise<MaterialProductMapping[]> {
    const results: MaterialProductMapping[] = [];
    
    for (const target of targets) {
      try {
        const [result] = await db.insert(materialProductMappings)
          .values({
            materialProductId,
            materialVariationId,
            productId: target.productId,
            variationId: target.variationId,
            quantityUsed: target.quantityUsed,
          })
          .returning();
        results.push(result);
      } catch (error: any) {
        // Skip duplicates (unique constraint violation)
        if (!error.message?.includes('unique') && !error.code?.includes('23505')) {
          throw error;
        }
      }
    }
    
    return results;
  }

  async updateMaterialMapping(id: number, quantityUsed: number): Promise<MaterialProductMapping | null> {
    const [result] = await db.update(materialProductMappings)
      .set({ quantityUsed })
      .where(eq(materialProductMappings.id, id))
      .returning();
    return result || null;
  }

  async deleteMaterialMapping(id: number): Promise<void> {
    await db.delete(materialProductMappings)
      .where(eq(materialProductMappings.id, id));
  }

  async getStockLedgerEntries(materialProductId?: number, limit: number = 100): Promise<StockLedgerEntry[]> {
    if (materialProductId) {
      return await db.select()
        .from(stockLedger)
        .where(eq(stockLedger.materialProductId, materialProductId))
        .orderBy(stockLedger.createdAt)
        .limit(limit);
    }
    return await db.select()
      .from(stockLedger)
      .orderBy(stockLedger.createdAt)
      .limit(limit);
  }

  async createStockLedgerEntry(entry: InsertStockLedger): Promise<StockLedgerEntry> {
    const [result] = await db.insert(stockLedger)
      .values(entry)
      .returning();
    return result;
  }

  async getProcessedOrder(orderId: number): Promise<ProcessedOrder | null> {
    const [result] = await db.select()
      .from(processedOrders)
      .where(eq(processedOrders.orderId, orderId))
      .limit(1);
    return result || null;
  }

  async getAllProcessedOrders(): Promise<ProcessedOrder[]> {
    return await db.select().from(processedOrders);
  }

  async markOrderProcessed(data: InsertProcessedOrder): Promise<ProcessedOrder> {
    const [result] = await db.insert(processedOrders)
      .values(data)
      .returning();
    return result;
  }

  async getCredentials(): Promise<DecryptedCredentials | null> {
    const [result] = await db.select()
      .from(wooCommerceCredentials)
      .where(eq(wooCommerceCredentials.isActive, true))
      .limit(1);
    
    if (!result) return null;
    
    try {
      return {
        storeUrl: result.storeUrl,
        consumerKey: decrypt(result.consumerKey),
        consumerSecret: decrypt(result.consumerSecret),
      };
    } catch (error) {
      console.error("Failed to decrypt credentials:", error);
      return null;
    }
  }

  async hasCredentials(): Promise<boolean> {
    const [result] = await db.select({ id: wooCommerceCredentials.id })
      .from(wooCommerceCredentials)
      .where(eq(wooCommerceCredentials.isActive, true))
      .limit(1);
    return !!result;
  }

  async saveCredentials(storeUrl: string, consumerKey: string, consumerSecret: string): Promise<void> {
    const encryptedKey = encrypt(consumerKey);
    const encryptedSecret = encrypt(consumerSecret);
    
    await db.delete(wooCommerceCredentials);
    
    await db.insert(wooCommerceCredentials)
      .values({
        storeUrl,
        consumerKey: encryptedKey,
        consumerSecret: encryptedSecret,
        isActive: true,
      });
  }

  async deleteCredentials(): Promise<void> {
    await db.delete(wooCommerceCredentials);
  }

  // ============================================
  // SUPPLIERS
  // ============================================

  async getSuppliers(activeOnly: boolean = true): Promise<Supplier[]> {
    if (activeOnly) {
      return await db.select()
        .from(suppliers)
        .where(eq(suppliers.isActive, true))
        .orderBy(asc(suppliers.name));
    }
    return await db.select()
      .from(suppliers)
      .orderBy(asc(suppliers.name));
  }

  async getSupplier(id: number): Promise<Supplier | null> {
    const [result] = await db.select()
      .from(suppliers)
      .where(eq(suppliers.id, id))
      .limit(1);
    return result || null;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [result] = await db.insert(suppliers)
      .values(supplier)
      .returning();
    return result;
  }

  async updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier | null> {
    const [result] = await db.update(suppliers)
      .set({ ...supplier, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    return result || null;
  }

  async deleteSupplier(id: number): Promise<void> {
    await db.update(suppliers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(suppliers.id, id));
  }

  async getSupplierStatistics(): Promise<{ supplierId: number; poCount: number; totalSpent: string }[]> {
    // Fetch all active suppliers
    const allSuppliers = await db.select({ id: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.isActive, true));
    
    // Fetch all non-cancelled purchase orders
    const allPurchaseOrders = await db.select({
      supplierId: purchaseOrders.supplierId,
      grandTotal: purchaseOrders.grandTotal,
    })
      .from(purchaseOrders)
      .where(sql`${purchaseOrders.status} != 'cancelled'`);
    
    // Aggregate in JavaScript
    const statsMap = new Map<number, { poCount: number; totalSpent: number }>();
    
    // Initialize all suppliers with zero values
    for (const supplier of allSuppliers) {
      statsMap.set(supplier.id, { poCount: 0, totalSpent: 0 });
    }
    
    // Aggregate purchase orders
    for (const po of allPurchaseOrders) {
      const existing = statsMap.get(po.supplierId);
      if (existing) {
        existing.poCount += 1;
        existing.totalSpent += parseFloat(po.grandTotal || "0");
      }
    }
    
    // Convert to result array
    return Array.from(statsMap.entries()).map(([supplierId, stats]) => ({
      supplierId,
      poCount: stats.poCount,
      totalSpent: stats.totalSpent.toFixed(2),
    }));
  }

  async getSupplierPurchaseOrders(supplierId: number): Promise<PurchaseOrderWithDetails[]> {
    const results = await db.select()
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(eq(purchaseOrders.supplierId, supplierId))
      .orderBy(desc(purchaseOrders.createdAt));

    const ordersWithItems: PurchaseOrderWithDetails[] = [];
    for (const row of results) {
      const po = row.purchase_orders;
      const supplier = row.suppliers;

      const items = await db.select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, po.id));

      ordersWithItems.push({
        ...po,
        supplier: supplier || undefined,
        items,
      });
    }

    return ordersWithItems;
  }

  // ============================================
  // PURCHASE ORDERS
  // ============================================

  async getPurchaseOrders(filters?: PurchaseOrderFilters): Promise<PurchaseOrderWithDetails[]> {
    let query = db.select()
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .orderBy(desc(purchaseOrders.createdAt));

    const results = await query;

    const ordersWithItems: PurchaseOrderWithDetails[] = [];
    for (const row of results) {
      const po = row.purchase_orders;
      const supplier = row.suppliers;

      if (filters?.status && po.status !== filters.status) continue;
      if (filters?.supplierId && po.supplierId !== filters.supplierId) continue;
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        if (!po.poNumber.toLowerCase().includes(searchLower) &&
            !(supplier?.name?.toLowerCase().includes(searchLower))) {
          continue;
        }
      }

      const items = await db.select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, po.id));

      ordersWithItems.push({
        ...po,
        supplier: supplier || undefined,
        items,
      });
    }

    return ordersWithItems;
  }

  async getPurchaseOrder(id: number): Promise<PurchaseOrderWithDetails | null> {
    const [row] = await db.select()
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(eq(purchaseOrders.id, id))
      .limit(1);

    if (!row) return null;

    const items = await db.select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, id));

    return {
      ...row.purchase_orders,
      supplier: row.suppliers || undefined,
      items,
    };
  }

  async getNextPONumber(): Promise<string> {
    const [result] = await db.select({ maxId: sql<number>`COALESCE(MAX(id), 0)` })
      .from(purchaseOrders);
    const nextNum = (result?.maxId || 0) + 1;
    const year = new Date().getFullYear();
    return `PO-${year}-${String(nextNum).padStart(4, '0')}`;
  }

  async createPurchaseOrder(po: InsertPurchaseOrder, items: InsertPurchaseOrderItem[]): Promise<PurchaseOrderWithDetails> {
    const [newPO] = await db.insert(purchaseOrders)
      .values(po)
      .returning();

    const insertedItems: PurchaseOrderItem[] = [];
    for (const item of items) {
      const [newItem] = await db.insert(purchaseOrderItems)
        .values({ ...item, purchaseOrderId: newPO.id })
        .returning();
      insertedItems.push(newItem);
    }

    const supplier = await this.getSupplier(newPO.supplierId);

    return {
      ...newPO,
      supplier: supplier || undefined,
      items: insertedItems,
    };
  }

  async updatePurchaseOrder(id: number, po: Partial<InsertPurchaseOrder>, items?: InsertPurchaseOrderItem[]): Promise<PurchaseOrderWithDetails | null> {
    const [updatedPO] = await db.update(purchaseOrders)
      .set({ ...po, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, id))
      .returning();

    if (!updatedPO) return null;

    if (items !== undefined) {
      await db.delete(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, id));

      for (const item of items) {
        await db.insert(purchaseOrderItems)
          .values({ ...item, purchaseOrderId: id });
      }
    }

    return await this.getPurchaseOrder(id);
  }

  async deletePurchaseOrder(id: number): Promise<void> {
    await db.delete(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, id));
    await db.delete(purchaseOrders)
      .where(eq(purchaseOrders.id, id));
  }

  // ============================================
  // PURCHASE ORDER ITEMS
  // ============================================

  async getPurchaseOrderItems(purchaseOrderId: number): Promise<PurchaseOrderItem[]> {
    return await db.select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
  }

  async addPurchaseOrderItem(purchaseOrderId: number, item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const [result] = await db.insert(purchaseOrderItems)
      .values({ ...item, purchaseOrderId })
      .returning();
    return result;
  }

  async updatePurchaseOrderItem(id: number, data: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem | null> {
    const [result] = await db.update(purchaseOrderItems)
      .set(data)
      .where(eq(purchaseOrderItems.id, id))
      .returning();
    return result || null;
  }

  async deletePurchaseOrderItem(id: number): Promise<void> {
    await db.delete(purchaseOrderItems)
      .where(eq(purchaseOrderItems.id, id));
  }

  async recalculatePurchaseOrderTotals(purchaseOrderId: number): Promise<PurchaseOrderWithDetails | null> {
    const po = await this.getPurchaseOrder(purchaseOrderId);
    if (!po) return null;

    let subtotal = 0;
    let itemsVat = 0;

    for (const item of po.items) {
      subtotal += parseFloat(item.lineSubtotal);
      itemsVat += parseFloat(item.lineVat);
    }

    const shippingCost = parseFloat(po.shippingCost);
    const shippingVatRate = parseFloat(po.shippingVatRate);
    const shippingVat = shippingCost * (shippingVatRate / 100);
    const vatTotal = itemsVat + shippingVat;
    const grandTotal = subtotal + vatTotal + shippingCost;

    await db.update(purchaseOrders)
      .set({
        subtotal: subtotal.toFixed(2),
        shippingVat: shippingVat.toFixed(2),
        vatTotal: vatTotal.toFixed(2),
        grandTotal: grandTotal.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, purchaseOrderId));

    return await this.getPurchaseOrder(purchaseOrderId);
  }

  async receivePurchaseOrderItems(
    purchaseOrderId: number, 
    itemReceipts: { itemId: number; quantityReceived: number }[]
  ): Promise<PurchaseOrderWithDetails> {
    for (const receipt of itemReceipts) {
      const [item] = await db.select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.id, receipt.itemId))
        .limit(1);

      if (item && receipt.quantityReceived > 0) {
        const newQuantityReceived = item.quantityReceived + receipt.quantityReceived;
        await db.update(purchaseOrderItems)
          .set({ quantityReceived: newQuantityReceived })
          .where(eq(purchaseOrderItems.id, receipt.itemId));
      }
    }

    const po = await this.getPurchaseOrder(purchaseOrderId);
    if (!po) throw new Error("Purchase order not found");

    const allReceived = po.items.every(item => item.quantityReceived >= item.quantityOrdered);
    const someReceived = po.items.some(item => item.quantityReceived > 0);

    let newStatus: "draft" | "ordered" | "partially_received" | "received" | "cancelled" = po.status;
    if (allReceived) {
      newStatus = "received";
    } else if (someReceived) {
      newStatus = "partially_received";
    }

    if (newStatus !== po.status) {
      await db.update(purchaseOrders)
        .set({ 
          status: newStatus, 
          receivedDate: allReceived ? new Date() : null,
          updatedAt: new Date() 
        })
        .where(eq(purchaseOrders.id, purchaseOrderId));
    }

    return (await this.getPurchaseOrder(purchaseOrderId))!;
  }

  // ============================================
  // LOCAL RAW MATERIALS
  // ============================================

  async getLocalRawMaterials(activeOnly: boolean = true): Promise<LocalRawMaterialWithVariations[]> {
    let materials: LocalRawMaterial[];
    if (activeOnly) {
      materials = await db.select()
        .from(rawMaterials)
        .where(eq(rawMaterials.isActive, true))
        .orderBy(asc(rawMaterials.name));
    } else {
      materials = await db.select()
        .from(rawMaterials)
        .orderBy(asc(rawMaterials.name));
    }

    // Fetch variations for each material
    const result: LocalRawMaterialWithVariations[] = [];
    for (const material of materials) {
      const variations = await db.select()
        .from(rawMaterialVariations)
        .where(and(
          eq(rawMaterialVariations.materialId, material.id),
          eq(rawMaterialVariations.isActive, true)
        ))
        .orderBy(asc(rawMaterialVariations.name));
      
      result.push({
        ...material,
        variations: variations.length > 0 ? variations : undefined,
      });
    }

    return result;
  }

  async getLocalRawMaterial(id: number): Promise<LocalRawMaterialWithVariations | null> {
    const [material] = await db.select()
      .from(rawMaterials)
      .where(eq(rawMaterials.id, id))
      .limit(1);

    if (!material) return null;

    const variations = await db.select()
      .from(rawMaterialVariations)
      .where(eq(rawMaterialVariations.materialId, id))
      .orderBy(asc(rawMaterialVariations.name));

    return {
      ...material,
      variations: variations.length > 0 ? variations : undefined,
    };
  }

  async getLocalRawMaterialByWooId(woocommerceId: number): Promise<LocalRawMaterial | null> {
    const [result] = await db.select()
      .from(rawMaterials)
      .where(eq(rawMaterials.woocommerceId, woocommerceId))
      .limit(1);
    return result || null;
  }

  async createLocalRawMaterial(material: InsertRawMaterial): Promise<LocalRawMaterial> {
    const [result] = await db.insert(rawMaterials)
      .values(material)
      .returning();
    return result;
  }

  async updateLocalRawMaterial(id: number, material: Partial<InsertRawMaterial>): Promise<LocalRawMaterial | null> {
    const [result] = await db.update(rawMaterials)
      .set({ ...material, updatedAt: new Date() })
      .where(eq(rawMaterials.id, id))
      .returning();
    return result || null;
  }

  async deleteLocalRawMaterial(id: number): Promise<void> {
    // Soft delete - set isActive to false
    await db.update(rawMaterials)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(rawMaterials.id, id));
  }

  async updateLocalRawMaterialStock(id: number, newStock: number): Promise<LocalRawMaterial | null> {
    const [result] = await db.update(rawMaterials)
      .set({ stockQuantity: newStock, updatedAt: new Date() })
      .where(eq(rawMaterials.id, id))
      .returning();
    return result || null;
  }

  // ============================================
  // LOCAL RAW MATERIAL VARIATIONS
  // ============================================

  async getLocalRawMaterialVariations(materialId: number): Promise<LocalRawMaterialVariation[]> {
    return await db.select()
      .from(rawMaterialVariations)
      .where(eq(rawMaterialVariations.materialId, materialId))
      .orderBy(asc(rawMaterialVariations.name));
  }

  async getLocalRawMaterialVariation(id: number): Promise<LocalRawMaterialVariation | null> {
    const [result] = await db.select()
      .from(rawMaterialVariations)
      .where(eq(rawMaterialVariations.id, id))
      .limit(1);
    return result || null;
  }

  async getLocalRawMaterialVariationByWooId(woocommerceId: number): Promise<LocalRawMaterialVariation | null> {
    const [result] = await db.select()
      .from(rawMaterialVariations)
      .where(eq(rawMaterialVariations.woocommerceId, woocommerceId))
      .limit(1);
    return result || null;
  }

  async createLocalRawMaterialVariation(variation: InsertRawMaterialVariation): Promise<LocalRawMaterialVariation> {
    const [result] = await db.insert(rawMaterialVariations)
      .values(variation)
      .returning();
    return result;
  }

  async updateLocalRawMaterialVariation(id: number, variation: Partial<InsertRawMaterialVariation>): Promise<LocalRawMaterialVariation | null> {
    const [result] = await db.update(rawMaterialVariations)
      .set({ ...variation, updatedAt: new Date() })
      .where(eq(rawMaterialVariations.id, id))
      .returning();
    return result || null;
  }

  async deleteLocalRawMaterialVariation(id: number): Promise<void> {
    // Soft delete
    await db.update(rawMaterialVariations)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(rawMaterialVariations.id, id));
  }

  async updateLocalRawMaterialVariationStock(id: number, newStock: number): Promise<LocalRawMaterialVariation | null> {
    const [result] = await db.update(rawMaterialVariations)
      .set({ stockQuantity: newStock, updatedAt: new Date() })
      .where(eq(rawMaterialVariations.id, id))
      .returning();
    return result || null;
  }
}

export const storage = new DatabaseStorage();
