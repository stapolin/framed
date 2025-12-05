import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { 
  fetchOrders, 
  getOrderStats, 
  getDateRange, 
  generateOrderTrends, 
  fetchOrderStatuses,
  fetchRawMaterials,
  fetchVariableProducts,
  fetchProductVariations,
  fetchAllProductsWithVariations,
  updateProductStock,
  updateVariationStock,
  updateOrderStatus,
  getProductById,
  getVariationById,
  fetchCustomers,
  fetchCustomerById,
  fetchCustomerOrders,
  type Customer
} from "./woocommerce";
import { storage, type DecryptedCredentials } from "./storage";
import { 
  insertMaterialProductMappingSchema, 
  wooCommerceConfigSchema,
  insertSupplierSchema,
  receiveItemsRequestSchema,
  type ProcessedOrder,
} from "@shared/schema";
import { invalidateStockCache, invalidateOrdersCache, invalidateAllCache, apiCache } from "./cache";
import { setupAuth, requireAuth } from "./auth";

async function getCredentialsFromStorage(): Promise<DecryptedCredentials | null> {
  return await storage.getCredentials();
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);
  
  app.get("/api/credentials/status", requireAuth, async (req, res) => {
    try {
      const hasCredentials = await storage.hasCredentials();
      const credentials = hasCredentials ? await storage.getCredentials() : null;
      res.json({ 
        configured: hasCredentials,
        storeUrl: credentials?.storeUrl || null 
      });
    } catch (error: any) {
      console.error("Error checking credentials:", error);
      res.status(500).json({ error: "Failed to check credentials status" });
    }
  });

  app.post("/api/credentials", requireAuth, async (req, res) => {
    try {
      const validated = wooCommerceConfigSchema.parse(req.body);
      await storage.saveCredentials(
        validated.storeUrl, 
        validated.consumerKey, 
        validated.consumerSecret
      );
      res.json({ success: true, storeUrl: validated.storeUrl });
    } catch (error: any) {
      console.error("Error saving credentials:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid credentials format", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save credentials" });
    }
  });

  app.delete("/api/credentials", requireAuth, async (req, res) => {
    try {
      await storage.deleteCredentials();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting credentials:", error);
      res.status(500).json({ error: "Failed to delete credentials" });
    }
  });

  // Cache management endpoints
  app.post("/api/cache/refresh", requireAuth, async (req, res) => {
    try {
      invalidateAllCache();
      res.json({ success: true, message: "Cache cleared. Fresh data will be fetched on next request." });
    } catch (error: any) {
      console.error("Error clearing cache:", error);
      res.status(500).json({ error: "Failed to clear cache" });
    }
  });

  app.get("/api/cache/stats", requireAuth, async (req, res) => {
    try {
      const stats = apiCache.getStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Error getting cache stats:", error);
      res.status(500).json({ error: "Failed to get cache stats" });
    }
  });

  app.get("/api/orders", requireAuth, async (req, res) => {
    try {
      const credentials = await getCredentialsFromStorage();
      const dateRangePreset = (req.query.dateRange as string) || "last30days";
      const status = req.query.status as string | undefined;

      if (!credentials) {
        return res.status(400).json({ 
          error: "WooCommerce credentials not configured. Please set up credentials in Settings." 
        });
      }

      const dateRange = getDateRange(dateRangePreset);
      const orders = await fetchOrders(
        credentials,
        { 
          after: dateRange.after, 
          per_page: 100,
          status: status 
        }
      );

      res.json(orders);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch orders" 
      });
    }
  });

  // Customers endpoints
  app.get("/api/customers", requireAuth, async (req, res) => {
    try {
      const credentials = await getCredentialsFromStorage();
      
      if (!credentials) {
        return res.status(400).json({ 
          error: "WooCommerce credentials not configured. Please set up credentials in Settings." 
        });
      }

      // Fetch customers - WooCommerce REST API includes native orders_count and total_spent fields
      // These are more accurate than computing from a limited order set
      const customers = await fetchCustomers(credentials);

      res.json(customers);
    } catch (error: any) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch customers" 
      });
    }
  });

  app.get("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const credentials = await getCredentialsFromStorage();
      const customerId = parseInt(req.params.id);
      
      if (!credentials) {
        return res.status(400).json({ 
          error: "WooCommerce credentials not configured. Please set up credentials in Settings." 
        });
      }

      const customer = await fetchCustomerById(credentials, customerId);
      res.json(customer);
    } catch (error: any) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch customer" 
      });
    }
  });

  app.get("/api/customers/:id/orders", requireAuth, async (req, res) => {
    try {
      const credentials = await getCredentialsFromStorage();
      const customerId = parseInt(req.params.id);
      
      if (!credentials) {
        return res.status(400).json({ 
          error: "WooCommerce credentials not configured. Please set up credentials in Settings." 
        });
      }

      const orders = await fetchCustomerOrders(credentials, customerId);
      res.json(orders);
    } catch (error: any) {
      console.error("Error fetching customer orders:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch customer orders" 
      });
    }
  });

  app.get("/api/metrics", requireAuth, async (req, res) => {
    try {
      const credentials = await getCredentialsFromStorage();
      const dateRangePreset = (req.query.dateRange as string) || "last30days";

      if (!credentials) {
        return res.status(400).json({ 
          error: "WooCommerce credentials not configured. Please set up credentials in Settings." 
        });
      }

      const dateRange = getDateRange(dateRangePreset);
      const orders = await fetchOrders(
        credentials,
        { after: dateRange.after, per_page: 100 }
      );

      const stats = await getOrderStats(orders);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch metrics" 
      });
    }
  });

  app.get("/api/trends", requireAuth, async (req, res) => {
    try {
      const credentials = await getCredentialsFromStorage();
      const dateRangePreset = (req.query.dateRange as string) || "last30days";

      if (!credentials) {
        return res.status(400).json({ 
          error: "WooCommerce credentials not configured. Please set up credentials in Settings." 
        });
      }

      const dateRange = getDateRange(dateRangePreset);
      const orders = await fetchOrders(
        credentials,
        { after: dateRange.after, per_page: 100 }
      );

      const trends = generateOrderTrends(orders);
      res.json(trends);
    } catch (error: any) {
      console.error("Error fetching trends:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch trends" 
      });
    }
  });

  app.get("/api/order-statuses", requireAuth, async (req, res) => {
    try {
      const credentials = await getCredentialsFromStorage();

      if (!credentials) {
        return res.status(400).json({ 
          error: "WooCommerce credentials not configured. Please set up credentials in Settings." 
        });
      }

      const statuses = await fetchOrderStatuses(credentials);
      res.json(statuses);
    } catch (error: any) {
      console.error("Error fetching order statuses:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch order statuses" 
      });
    }
  });

  app.get("/api/export/csv", requireAuth, async (req, res) => {
    try {
      const credentials = await getCredentialsFromStorage();
      const dateRangePreset = (req.query.dateRange as string) || "last30days";
      const statusFilter = req.query.status as string | undefined;
      const searchFilter = req.query.search as string | undefined;

      if (!credentials) {
        return res.status(400).json({ 
          error: "WooCommerce credentials not configured. Please set up credentials in Settings." 
        });
      }

      const dateRange = getDateRange(dateRangePreset);
      let orders = await fetchOrders(
        credentials,
        { after: dateRange.after, per_page: 100 }
      );

      if (statusFilter) {
        orders = orders.filter((order: any) => order.status === statusFilter);
      }

      if (searchFilter) {
        const searchLower = searchFilter.toLowerCase();
        orders = orders.filter((order: any) => 
          order.number.toLowerCase().includes(searchLower) ||
          `${order.billing.first_name} ${order.billing.last_name}`.toLowerCase().includes(searchLower) ||
          order.billing.email.toLowerCase().includes(searchLower)
        );
      }

      const csvHeaders = ["Order", "Customer", "Email", "Date", "Status", "Total"];
      const csvRows = orders.map((order: any) => [
        order.number,
        `${order.billing.first_name} ${order.billing.last_name}`,
        order.billing.email,
        new Date(order.date_created).toLocaleDateString(),
        order.status,
        `${order.currency} ${order.total}`,
      ]);

      const csvContent = [
        csvHeaders.join(","),
        ...csvRows.map((row: any[]) => row.map((cell: any) => `"${cell}"`).join(","))
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="woocommerce-orders-${dateRangePreset}-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(csvContent);
    } catch (error: any) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ 
        error: error.message || "Failed to export CSV" 
      });
    }
  });

  // Raw Materials endpoints
  app.get("/api/raw-materials", requireAuth, async (req, res) => {
    try {
      const credentials = await getCredentialsFromStorage();

      if (!credentials) {
        return res.status(400).json({ 
          error: "WooCommerce credentials not configured. Please set up credentials in Settings." 
        });
      }

      const materials = await fetchRawMaterials(credentials);
      res.json(materials);
    } catch (error: any) {
      console.error("Error fetching raw materials:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch raw materials" 
      });
    }
  });

  // Variable products endpoints
  app.get("/api/variable-products", requireAuth, async (req, res) => {
    try {
      const credentials = await getCredentialsFromStorage();

      if (!credentials) {
        return res.status(400).json({ 
          error: "WooCommerce credentials not configured. Please set up credentials in Settings." 
        });
      }

      const products = await fetchVariableProducts(credentials);
      res.json(products);
    } catch (error: any) {
      console.error("Error fetching variable products:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch variable products" 
      });
    }
  });

  app.get("/api/products/:productId/variations", requireAuth, async (req, res) => {
    try {
      const credentials = await getCredentialsFromStorage();
      const productId = parseInt(req.params.productId);

      if (!credentials) {
        return res.status(400).json({ 
          error: "WooCommerce credentials not configured. Please set up credentials in Settings." 
        });
      }

      const variations = await fetchProductVariations(credentials, productId);
      res.json(variations);
    } catch (error: any) {
      console.error("Error fetching product variations:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch product variations" 
      });
    }
  });

  app.get("/api/products-with-variations", requireAuth, async (req, res) => {
    try {
      const credentials = await getCredentialsFromStorage();

      if (!credentials) {
        return res.status(400).json({ 
          error: "WooCommerce credentials not configured. Please set up credentials in Settings." 
        });
      }

      const products = await fetchAllProductsWithVariations(credentials);
      res.json(products);
    } catch (error: any) {
      console.error("Error fetching products with variations:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch products with variations" 
      });
    }
  });

  // Material mappings endpoints
  app.get("/api/material-mappings", requireAuth, async (req, res) => {
    try {
      const mappings = await storage.getMaterialMappings();
      res.json(mappings);
    } catch (error: any) {
      console.error("Error fetching material mappings:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch material mappings" 
      });
    }
  });

  app.post("/api/material-mappings", requireAuth, async (req, res) => {
    try {
      const validated = insertMaterialProductMappingSchema.parse(req.body);
      const mapping = await storage.createMaterialMapping(validated);
      res.status(201).json(mapping);
    } catch (error: any) {
      console.error("Error creating material mapping:", error);
      res.status(500).json({ 
        error: error.message || "Failed to create material mapping" 
      });
    }
  });

  app.delete("/api/material-mappings/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteMaterialMapping(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting material mapping:", error);
      res.status(500).json({ 
        error: error.message || "Failed to delete material mapping" 
      });
    }
  });

  // Get mappings for a specific material (with optional variation filter)
  app.get("/api/material-mappings/by-material/:materialProductId", requireAuth, async (req, res) => {
    try {
      const materialProductId = parseInt(req.params.materialProductId);
      const materialVariationId = req.query.materialVariationId !== undefined 
        ? (req.query.materialVariationId === 'null' ? null : parseInt(req.query.materialVariationId as string))
        : undefined;
      
      const mappings = await storage.getMaterialMappingsForMaterial(materialProductId, materialVariationId);
      res.json(mappings);
    } catch (error: any) {
      console.error("Error fetching material mappings:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch material mappings" 
      });
    }
  });

  // Bulk create mappings for a material to multiple products
  app.post("/api/material-mappings/bulk", requireAuth, async (req, res) => {
    try {
      const { materialProductId, materialVariationId, targets } = req.body;
      
      if (!materialProductId || !Array.isArray(targets) || targets.length === 0) {
        return res.status(400).json({ 
          error: "materialProductId and non-empty targets array required" 
        });
      }

      // Validate targets
      for (const target of targets) {
        if (typeof target.productId !== 'number' || typeof target.quantityUsed !== 'number') {
          return res.status(400).json({ 
            error: "Each target must have productId and quantityUsed as numbers" 
          });
        }
      }

      const mappings = await storage.bulkCreateMaterialMappings(
        materialProductId, 
        materialVariationId ?? null, 
        targets
      );
      
      res.status(201).json(mappings);
    } catch (error: any) {
      console.error("Error creating bulk material mappings:", error);
      res.status(500).json({ 
        error: error.message || "Failed to create bulk material mappings" 
      });
    }
  });

  // Update a mapping's quantity
  app.patch("/api/material-mappings/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { quantityUsed } = req.body;
      
      if (typeof quantityUsed !== 'number' || quantityUsed < 1) {
        return res.status(400).json({ 
          error: "quantityUsed must be a positive number" 
        });
      }

      const mapping = await storage.updateMaterialMapping(id, quantityUsed);
      
      if (!mapping) {
        return res.status(404).json({ error: "Mapping not found" });
      }
      
      res.json(mapping);
    } catch (error: any) {
      console.error("Error updating material mapping:", error);
      res.status(500).json({ 
        error: error.message || "Failed to update material mapping" 
      });
    }
  });

  // ============================================
  // LOCAL RAW MATERIALS API
  // ============================================

  // Get all local raw materials with their variations
  app.get("/api/local-materials", requireAuth, async (req, res) => {
    try {
      const activeOnly = req.query.activeOnly !== 'false';
      const materials = await storage.getLocalRawMaterials(activeOnly);
      res.json(materials);
    } catch (error: any) {
      console.error("Error fetching local materials:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch local materials" 
      });
    }
  });

  // Get a single local raw material by ID
  app.get("/api/local-materials/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const material = await storage.getLocalRawMaterial(id);
      
      if (!material) {
        return res.status(404).json({ error: "Material not found" });
      }
      
      res.json(material);
    } catch (error: any) {
      console.error("Error fetching local material:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch local material" 
      });
    }
  });

  // Create a new local raw material
  app.post("/api/local-materials", requireAuth, async (req, res) => {
    try {
      const { name, sku, type, stockQuantity, manageStock, lowStockThreshold, imageUrl, notes } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Material name is required" });
      }

      const material = await storage.createLocalRawMaterial({
        name,
        sku: sku || null,
        type: type || 'simple',
        stockQuantity: stockQuantity || 0,
        manageStock: manageStock !== false,
        lowStockThreshold: lowStockThreshold || 5,
        imageUrl: imageUrl || null,
        notes: notes || null,
      });
      
      res.status(201).json(material);
    } catch (error: any) {
      console.error("Error creating local material:", error);
      res.status(500).json({ 
        error: error.message || "Failed to create local material" 
      });
    }
  });

  // Update a local raw material
  app.patch("/api/local-materials/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      const material = await storage.updateLocalRawMaterial(id, updates);
      
      if (!material) {
        return res.status(404).json({ error: "Material not found" });
      }
      
      res.json(material);
    } catch (error: any) {
      console.error("Error updating local material:", error);
      res.status(500).json({ 
        error: error.message || "Failed to update local material" 
      });
    }
  });

  // Delete (soft delete) a local raw material
  app.delete("/api/local-materials/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLocalRawMaterial(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting local material:", error);
      res.status(500).json({ 
        error: error.message || "Failed to delete local material" 
      });
    }
  });

  // Update stock for a local raw material
  app.patch("/api/local-materials/:id/stock", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { stockQuantity } = req.body;
      
      if (typeof stockQuantity !== 'number') {
        return res.status(400).json({ error: "stockQuantity must be a number" });
      }

      const material = await storage.updateLocalRawMaterialStock(id, stockQuantity);
      
      if (!material) {
        return res.status(404).json({ error: "Material not found" });
      }
      
      res.json(material);
    } catch (error: any) {
      console.error("Error updating local material stock:", error);
      res.status(500).json({ 
        error: error.message || "Failed to update local material stock" 
      });
    }
  });

  // ============================================
  // LOCAL RAW MATERIAL VARIATIONS API
  // ============================================

  // Get variations for a specific material
  app.get("/api/local-materials/:materialId/variations", requireAuth, async (req, res) => {
    try {
      const materialId = parseInt(req.params.materialId);
      const variations = await storage.getLocalRawMaterialVariations(materialId);
      res.json(variations);
    } catch (error: any) {
      console.error("Error fetching local material variations:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch local material variations" 
      });
    }
  });

  // Create a variation for a material
  app.post("/api/local-materials/:materialId/variations", requireAuth, async (req, res) => {
    try {
      const materialId = parseInt(req.params.materialId);
      const { name, sku, stockQuantity, manageStock, lowStockThreshold, attributes } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Variation name is required" });
      }

      const variation = await storage.createLocalRawMaterialVariation({
        materialId,
        name,
        sku: sku || null,
        stockQuantity: stockQuantity || 0,
        manageStock: manageStock !== false,
        lowStockThreshold: lowStockThreshold || 5,
        attributes: attributes ? JSON.stringify(attributes) : null,
      });
      
      res.status(201).json(variation);
    } catch (error: any) {
      console.error("Error creating local material variation:", error);
      res.status(500).json({ 
        error: error.message || "Failed to create local material variation" 
      });
    }
  });

  // Update a variation
  app.patch("/api/local-material-variations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      // If attributes is an object, stringify it
      if (updates.attributes && typeof updates.attributes === 'object') {
        updates.attributes = JSON.stringify(updates.attributes);
      }
      
      const variation = await storage.updateLocalRawMaterialVariation(id, updates);
      
      if (!variation) {
        return res.status(404).json({ error: "Variation not found" });
      }
      
      res.json(variation);
    } catch (error: any) {
      console.error("Error updating local material variation:", error);
      res.status(500).json({ 
        error: error.message || "Failed to update local material variation" 
      });
    }
  });

  // Delete (soft delete) a variation
  app.delete("/api/local-material-variations/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLocalRawMaterialVariation(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting local material variation:", error);
      res.status(500).json({ 
        error: error.message || "Failed to delete local material variation" 
      });
    }
  });

  // Update stock for a variation
  app.patch("/api/local-material-variations/:id/stock", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { stockQuantity } = req.body;
      
      if (typeof stockQuantity !== 'number') {
        return res.status(400).json({ error: "stockQuantity must be a number" });
      }

      const variation = await storage.updateLocalRawMaterialVariationStock(id, stockQuantity);
      
      if (!variation) {
        return res.status(404).json({ error: "Variation not found" });
      }
      
      res.json(variation);
    } catch (error: any) {
      console.error("Error updating local material variation stock:", error);
      res.status(500).json({ 
        error: error.message || "Failed to update local material variation stock" 
      });
    }
  });

  // ============================================
  // IMPORT FROM WOOCOMMERCE
  // ============================================

  // Import raw materials from WooCommerce into local database
  app.post("/api/local-materials/import-from-woocommerce", requireAuth, async (req, res) => {
    try {
      const credentials = await getCredentialsFromStorage();

      if (!credentials) {
        return res.status(400).json({ 
          error: "WooCommerce credentials not configured. Please set up credentials in Settings." 
        });
      }

      // Fetch raw materials from WooCommerce
      const wooMaterials = await fetchRawMaterials(credentials);
      
      let imported = 0;
      let skipped = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const material of wooMaterials) {
        try {
          // Check if material already exists by WooCommerce ID
          const existing = await storage.getLocalRawMaterialByWooId(material.id);
          
          if (existing) {
            skipped++;
            continue;
          }

          // Determine type
          const type = material.type === 'variable' ? 'variable' : 'simple';

          // Create the material
          const newMaterial = await storage.createLocalRawMaterial({
            woocommerceId: material.id,
            name: material.name,
            sku: material.sku || null,
            type,
            stockQuantity: material.stock_quantity || 0,
            manageStock: material.manage_stock !== false,
            lowStockThreshold: material.low_stock_amount || 5,
            imageUrl: material.images?.[0]?.src || null,
            notes: null,
          });

          // If variable product, fetch and import variations
          if (type === 'variable' && material.variations && material.variations.length > 0) {
            const variations = await fetchProductVariations(credentials, material.id);
            
            for (const variation of variations) {
              try {
                // Create variation name from attributes
                const attrNames = variation.attributes?.map((a: any) => a.option).join(' - ') || `Variation ${variation.id}`;
                
                await storage.createLocalRawMaterialVariation({
                  materialId: newMaterial.id,
                  woocommerceId: variation.id,
                  name: attrNames,
                  sku: variation.sku || null,
                  stockQuantity: variation.stock_quantity || 0,
                  manageStock: variation.manage_stock !== false,
                  lowStockThreshold: variation.low_stock_amount || 5,
                  attributes: variation.attributes ? JSON.stringify(variation.attributes) : null,
                });
              } catch (varErr: any) {
                console.error(`Error importing variation ${variation.id}:`, varErr);
                errors.push(`Variation ${variation.id}: ${varErr.message}`);
              }
            }
          }

          imported++;
        } catch (err: any) {
          console.error(`Error importing material ${material.id} (${material.name}):`, err);
          errors.push(`${material.name}: ${err.message}`);
        }
      }

      res.json({
        success: true,
        imported,
        skipped,
        updated,
        errors: errors.length > 0 ? errors : undefined,
        message: `Imported ${imported} materials, skipped ${skipped} already existing.${errors.length > 0 ? ` ${errors.length} errors occurred.` : ''}`
      });
    } catch (error: any) {
      console.error("Error importing from WooCommerce:", error);
      res.status(500).json({ 
        error: error.message || "Failed to import from WooCommerce" 
      });
    }
  });

  // ============================================
  // LOCAL MATERIALS STOCK MANAGEMENT (with ledger)
  // ============================================

  // Add stock to a local raw material (creates ledger entry)
  app.post("/api/local-materials/:id/add-stock", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { quantity, notes } = req.body;
      
      if (typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).json({ error: "Quantity must be a positive number" });
      }

      const material = await storage.getLocalRawMaterial(id);
      if (!material) {
        return res.status(404).json({ error: "Material not found" });
      }

      const previousStock = material.stockQuantity || 0;
      const newStock = previousStock + quantity;

      await storage.updateLocalRawMaterialStock(id, newStock);

      await storage.createStockLedgerEntry({
        materialProductId: id,
        materialVariationId: null,
        quantityChange: quantity,
        previousStock,
        newStock,
        reason: "manual",
        notes: notes || "Stock added manually",
      });

      res.json({
        success: true,
        previousStock,
        quantityAdded: quantity,
        newStock,
        materialName: material.name,
      });
    } catch (error: any) {
      console.error("Error adding stock to local material:", error);
      res.status(500).json({ 
        error: error.message || "Failed to add stock" 
      });
    }
  });

  // Set stock level for a local raw material (stock take - creates ledger entry)
  app.post("/api/local-materials/:id/set-stock", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { newStockLevel, notes } = req.body;
      
      if (typeof newStockLevel !== 'number' || newStockLevel < 0) {
        return res.status(400).json({ error: "Stock level must be a non-negative number" });
      }

      const material = await storage.getLocalRawMaterial(id);
      if (!material) {
        return res.status(404).json({ error: "Material not found" });
      }

      const previousStock = material.stockQuantity || 0;
      const quantityChange = newStockLevel - previousStock;

      await storage.updateLocalRawMaterialStock(id, newStockLevel);

      await storage.createStockLedgerEntry({
        materialProductId: id,
        materialVariationId: null,
        quantityChange,
        previousStock,
        newStock: newStockLevel,
        reason: "stock_take",
        notes: notes || "Stock level set during stock take",
      });

      res.json({
        success: true,
        previousStock,
        quantityChange,
        newStock: newStockLevel,
        materialName: material.name,
      });
    } catch (error: any) {
      console.error("Error setting stock for local material:", error);
      res.status(500).json({ 
        error: error.message || "Failed to set stock" 
      });
    }
  });

  // Add stock to a local raw material variation (creates ledger entry)
  app.post("/api/local-materials/:materialId/variations/:variationId/add-stock", requireAuth, async (req, res) => {
    try {
      const materialId = parseInt(req.params.materialId);
      const variationId = parseInt(req.params.variationId);
      const { quantity, notes } = req.body;
      
      if (typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).json({ error: "Quantity must be a positive number" });
      }

      const material = await storage.getLocalRawMaterial(materialId);
      if (!material) {
        return res.status(404).json({ error: "Material not found" });
      }

      const variation = await storage.getLocalRawMaterialVariation(variationId);
      if (!variation || variation.materialId !== materialId) {
        return res.status(404).json({ error: "Variation not found" });
      }

      const previousStock = variation.stockQuantity || 0;
      const newStock = previousStock + quantity;

      await storage.updateLocalRawMaterialVariationStock(variationId, newStock);

      await storage.createStockLedgerEntry({
        materialProductId: materialId,
        materialVariationId: variationId,
        quantityChange: quantity,
        previousStock,
        newStock,
        reason: "manual",
        notes: notes || "Stock added manually",
      });

      res.json({
        success: true,
        previousStock,
        quantityAdded: quantity,
        newStock,
        materialName: material.name,
        variationName: variation.name,
      });
    } catch (error: any) {
      console.error("Error adding stock to local material variation:", error);
      res.status(500).json({ 
        error: error.message || "Failed to add stock to variation" 
      });
    }
  });

  // Set stock level for a local raw material variation (stock take - creates ledger entry)
  app.post("/api/local-materials/:materialId/variations/:variationId/set-stock", requireAuth, async (req, res) => {
    try {
      const materialId = parseInt(req.params.materialId);
      const variationId = parseInt(req.params.variationId);
      const { newStockLevel, notes } = req.body;
      
      if (typeof newStockLevel !== 'number' || newStockLevel < 0) {
        return res.status(400).json({ error: "Stock level must be a non-negative number" });
      }

      const material = await storage.getLocalRawMaterial(materialId);
      if (!material) {
        return res.status(404).json({ error: "Material not found" });
      }

      const variation = await storage.getLocalRawMaterialVariation(variationId);
      if (!variation || variation.materialId !== materialId) {
        return res.status(404).json({ error: "Variation not found" });
      }

      const previousStock = variation.stockQuantity || 0;
      const quantityChange = newStockLevel - previousStock;

      await storage.updateLocalRawMaterialVariationStock(variationId, newStockLevel);

      await storage.createStockLedgerEntry({
        materialProductId: materialId,
        materialVariationId: variationId,
        quantityChange,
        previousStock,
        newStock: newStockLevel,
        reason: "stock_take",
        notes: notes || "Stock level set during stock take",
      });

      res.json({
        success: true,
        previousStock,
        quantityChange,
        newStock: newStockLevel,
        materialName: material.name,
        variationName: variation.name,
      });
    } catch (error: any) {
      console.error("Error setting stock for local material variation:", error);
      res.status(500).json({ 
        error: error.message || "Failed to set variation stock" 
      });
    }
  });

  // Stock ledger endpoints
  app.get("/api/stock-ledger", requireAuth, async (req, res) => {
    try {
      const materialProductId = req.query.materialProductId 
        ? parseInt(req.query.materialProductId as string) 
        : undefined;
      const limit = req.query.limit 
        ? parseInt(req.query.limit as string) 
        : 100;
      
      const entries = await storage.getStockLedgerEntries(materialProductId, limit);
      res.json(entries);
    } catch (error: any) {
      console.error("Error fetching stock ledger:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch stock ledger" 
      });
    }
  });

  // Check if order has been processed for inventory
  app.get("/api/processed-orders/:orderId", requireAuth, async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const processed = await storage.getProcessedOrder(orderId);
      res.json({ processed: !!processed, data: processed });
    } catch (error: any) {
      console.error("Error checking processed order:", error);
      res.status(500).json({ 
        error: error.message || "Failed to check processed order" 
      });
    }
  });

  // Update order status
  app.put("/api/orders/:orderId/status", requireAuth, async (req, res) => {
    try {
      const credentials = await getCredentialsFromStorage();
      const orderId = parseInt(req.params.orderId);
      const { status } = req.body;

      if (!credentials) {
        return res.status(400).json({ 
          error: "WooCommerce credentials not configured. Please set up credentials in Settings." 
        });
      }

      if (!status) {
        return res.status(400).json({ 
          error: "Status is required" 
        });
      }

      const updatedOrder = await updateOrderStatus(
        credentials, 
        orderId, 
        status
      );
      
      res.json(updatedOrder);
    } catch (error: any) {
      console.error("Error updating order status:", error);
      res.status(500).json({ 
        error: error.message || "Failed to update order status" 
      });
    }
  });

  // Calculate order fulfillment status based on available raw materials stock
  // Prioritizes older orders first for stock allocation
  // Uses local PostgreSQL materials instead of WooCommerce API
  app.get("/api/orders/fulfillment-status", requireAuth, async (req, res) => {
    try {
      const credentials = await getCredentialsFromStorage();
      const dateRangePreset = (req.query.dateRange as string) || "last30days";

      if (!credentials) {
        return res.status(400).json({ 
          error: "WooCommerce credentials not configured. Please set up credentials in Settings." 
        });
      }

      const dateRange = getDateRange(dateRangePreset);
      const orders = await fetchOrders(
        credentials,
        { after: dateRange.after, per_page: 100 }
      );

      // Fetch raw materials from local PostgreSQL database
      const localMaterials = await storage.getLocalRawMaterials();
      const materialsMap = new Map<string, number>();
      
      // Build maps for looking up materials by local ID or WooCommerce ID
      const materialsByLocalId = new Map(localMaterials.map(m => [m.id, m]));
      const materialsByWooId = new Map(localMaterials.map(m => [m.woocommerceId, m]));
      
      // Helper to find material by either local ID or WooCommerce ID
      const findMaterial = (id: number) => materialsByLocalId.get(id) || materialsByWooId.get(id);
      
      // Helper to normalize any material ID to canonical local ID
      const normalizeId = (id: number): number => {
        const byLocal = materialsByLocalId.get(id);
        if (byLocal) return byLocal.id;
        const byWoo = materialsByWooId.get(id);
        if (byWoo) return byWoo.id;
        return id; // Not found, return as-is
      };
      
      // Helper to normalize variation ID to canonical local variation ID
      const normalizeVariationId = (material: any, varId: number | null): number | null => {
        if (!varId || !material?.variations) return varId;
        const variation = material.variations.find((v: any) => v.id === varId || v.woocommerceId === varId);
        return variation ? variation.id : varId;
      };
      
      // Build stock map using CANONICAL local IDs only
      // This prevents double-counting when mappings reference same material with different IDs
      for (const material of localMaterials) {
        if (material.type === "variable" && material.variations && material.variations.length > 0) {
          let totalVariationStock = 0;
          for (const variation of material.variations) {
            const stock = variation.stockQuantity || 0;
            totalVariationStock += stock;
            // Store under canonical local ID only
            materialsMap.set(`${material.id}-${variation.id}`, stock);
          }
          // Store total stock for mappings without specific variation
          materialsMap.set(`${material.id}-null`, totalVariationStock);
        } else {
          // Simple product
          const stock = material.stockQuantity || 0;
          materialsMap.set(`${material.id}-null`, stock);
        }
      }

      // Get all mappings
      const allMappings = await storage.getMaterialMappings();

      // Get processed orders
      const processedOrdersList = await storage.getAllProcessedOrders();
      const processedOrderIds = new Set(processedOrdersList.map((p: ProcessedOrder) => p.orderId));

      // Only include orders with statuses that need fulfillment tracking
      // Exclude completed orders and other final statuses
      const fulfillmentStatuses = ['pending', 'order-received', 'production'];
      const relevantOrders = orders.filter((order: any) => 
        fulfillmentStatuses.includes(order.status)
      );

      // Sort orders by date (oldest first) to prioritize older orders
      const sortedOrders = [...relevantOrders].sort((a: any, b: any) => 
        new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
      );

      // Track cumulative stock usage
      const cumulativeStockUsed = new Map<string, number>();

      const fulfillmentStatus: Record<number, { 
        canFulfill: boolean; 
        missingMaterials: Array<{ 
          materialId: number; 
          variationId: number | null;
          materialName: string;
          needed: number; 
          available: number;
        }>;
        isProcessed: boolean;
      }> = {};

      for (const order of sortedOrders) {
        const isProcessed = processedOrderIds.has(order.id);
        const orderMissingMaterials: Array<{
          materialId: number;
          variationId: number | null;
          materialName: string;
          needed: number;
          available: number;
        }> = [];

        // Skip already processed orders for stock calculation but still mark them
        if (isProcessed) {
          fulfillmentStatus[order.id] = { 
            canFulfill: true, 
            missingMaterials: [], 
            isProcessed: true 
          };
          continue;
        }

        // Calculate materials needed for this order
        const materialsNeeded = new Map<string, { needed: number; materialName: string; materialId: number; variationId: number | null }>();

        for (const item of order.line_items) {
          const productId = item.product_id;
          const variationId = (item as any).variation_id || null;
          
          // Find mappings for this product/variation
          const itemMappings = allMappings.filter((m: any) => 
            m.productId === productId && 
            (variationId ? m.variationId === variationId : m.variationId === null)
          );

          for (const mapping of itemMappings) {
            // Find material and normalize IDs to canonical local IDs
            const material = findMaterial(mapping.materialProductId);
            
            // Skip orphaned mappings that reference non-existent materials
            // This matches the behavior of the required-materials endpoint
            if (!material) continue;
            
            const normalizedMaterialId = normalizeId(mapping.materialProductId);
            const normalizedVariationId = normalizeVariationId(material, mapping.materialVariationId);
            const key = `${normalizedMaterialId}-${normalizedVariationId || 'null'}`;
            const quantityNeeded = mapping.quantityUsed * item.quantity;
            
            let materialName = material.name;
            
            if (mapping.materialVariationId && material.variations) {
              // Find variation by local ID or WooCommerce ID
              const variation = material.variations.find(v => 
                v.id === mapping.materialVariationId || v.woocommerceId === mapping.materialVariationId
              );
              if (variation) {
                materialName = `${materialName} - ${variation.name}`;
              }
            }

            const existing = materialsNeeded.get(key);
            if (existing) {
              existing.needed += quantityNeeded;
            } else {
              materialsNeeded.set(key, { 
                needed: quantityNeeded, 
                materialName,
                materialId: normalizedMaterialId,
                variationId: normalizedVariationId
              });
            }
          }
        }

        // Check if we can fulfill this order with remaining stock
        let canFulfill = true;

        for (const [key, { needed, materialName, materialId, variationId }] of Array.from(materialsNeeded.entries())) {
          const originalStock = materialsMap.get(key) || 0;
          const alreadyUsed = cumulativeStockUsed.get(key) || 0;
          const availableStock = originalStock - alreadyUsed;

          if (availableStock < needed) {
            canFulfill = false;
            orderMissingMaterials.push({
              materialId,
              variationId,
              materialName,
              needed,
              available: Math.max(0, availableStock)
            });
          }
        }

        // If can fulfill, add to cumulative usage
        if (canFulfill) {
          for (const [key, { needed }] of Array.from(materialsNeeded.entries())) {
            const current = cumulativeStockUsed.get(key) || 0;
            cumulativeStockUsed.set(key, current + needed);
          }
        }

        fulfillmentStatus[order.id] = { 
          canFulfill, 
          missingMaterials: orderMissingMaterials,
          isProcessed: false
        };
      }

      res.json(fulfillmentStatus);
    } catch (error: any) {
      console.error("Error calculating fulfillment status:", error);
      res.status(500).json({ 
        error: error.message || "Failed to calculate fulfillment status" 
      });
    }
  });

  // Get required raw materials for a specific order
  // Uses local PostgreSQL materials instead of WooCommerce API
  app.get("/api/orders/:orderId/required-materials", requireAuth, async (req, res) => {
    try {
      const credentials = await getCredentialsFromStorage();
      const orderId = parseInt(req.params.orderId);

      if (!credentials) {
        return res.status(400).json({ 
          error: "WooCommerce credentials not configured. Please set up credentials in Settings." 
        });
      }

      // Fetch the order
      const orders = await fetchOrders(credentials, { per_page: 100 });
      const order = orders.find((o: any) => o.id === orderId);

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Fetch raw materials from local PostgreSQL database
      const localMaterials = await storage.getLocalRawMaterials();
      const allMappings = await storage.getMaterialMappings();

      // Calculate materials needed for this order
      const requiredMaterials: Array<{
        materialId: number;
        variationId: number | null;
        materialName: string;
        quantityNeeded: number;
        currentStock: number;
        hasSufficientStock: boolean;
        productName: string;
        variationName: string | null;
      }> = [];

      for (const item of order.line_items) {
        const productId = item.product_id;
        const variationId = (item as any).variation_id || null;
        
        // Find mappings for this product/variation
        const itemMappings = allMappings.filter((m: any) => 
          m.productId === productId && 
          (variationId ? m.variationId === variationId : m.variationId === null)
        );

        for (const mapping of itemMappings) {
          const quantityNeeded = mapping.quantityUsed * item.quantity;
          
          // Find material and its current stock from local database
          const material = localMaterials.find(m => m.id === mapping.materialProductId);
          if (!material) continue;

          let materialName = material.name;
          let currentStock = material.stockQuantity || 0;

          if (mapping.materialVariationId && material.variations) {
            const variation = material.variations.find(v => v.id === mapping.materialVariationId);
            if (variation) {
              materialName = `${material.name} - ${variation.name}`;
              currentStock = variation.stockQuantity || 0;
            }
          }

          // Get variation name from item metadata
          let variationName: string | null = null;
          if (variationId && item.meta_data) {
            const attrs = item.meta_data
              .filter((m: any) => m.display_key && m.display_value && !m.key.startsWith('_') && typeof m.display_value !== 'object')
              .map((m: any) => `${m.display_key}: ${m.display_value}`)
              .join(', ');
            if (attrs) variationName = attrs;
          }

          requiredMaterials.push({
            materialId: mapping.materialProductId,
            variationId: mapping.materialVariationId,
            materialName,
            quantityNeeded,
            currentStock,
            hasSufficientStock: currentStock >= quantityNeeded,
            productName: item.name,
            variationName
          });
        }
      }

      // Check if order is already processed
      const processedStatus = await storage.getProcessedOrder(orderId);

      res.json({
        orderId,
        orderNumber: order.number,
        isProcessed: !!processedStatus,
        processedAt: processedStatus?.processedAt,
        requiredMaterials,
        canFulfill: requiredMaterials.every(m => m.hasSufficientStock)
      });
    } catch (error: any) {
      console.error("Error fetching required materials:", error);
      res.status(500).json({ 
        error: error.message || "Failed to fetch required materials" 
      });
    }
  });

  // Add stock to raw material (stock in from suppliers) - uses local PostgreSQL
  app.post("/api/raw-materials/:productId/add-stock", requireAuth, async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      const { quantity, notes } = req.body;

      if (!quantity || quantity <= 0) {
        return res.status(400).json({ 
          error: "Quantity must be a positive number" 
        });
      }
      
      // Get current material from local database
      const material = await storage.getLocalRawMaterial(productId);
      if (!material) {
        return res.status(404).json({ error: "Material not found" });
      }
      
      const previousStock = material.stockQuantity || 0;
      const newStock = previousStock + quantity;

      // Update stock in local PostgreSQL
      await storage.updateLocalRawMaterialStock(productId, newStock);

      // Log to stock ledger
      const ledgerEntry = await storage.createStockLedgerEntry({
        materialProductId: productId,
        orderId: null,
        orderNumber: null,
        quantityChange: quantity,
        previousStock,
        newStock,
        reason: "stock_in",
        notes: notes || "Stock received from supplier",
      });

      // Invalidate stock cache
      invalidateStockCache();

      res.json({
        success: true,
        productId,
        productName: material.name,
        previousStock,
        newStock,
        quantityAdded: quantity,
        ledgerEntryId: ledgerEntry.id,
      });
    } catch (error: any) {
      console.error("Error adding stock:", error);
      res.status(500).json({ 
        error: error.message || "Failed to add stock" 
      });
    }
  });

  // Set absolute stock level (stock take) - uses local PostgreSQL
  app.post("/api/raw-materials/:productId/set-stock", requireAuth, async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      const { newStockLevel, notes } = req.body;

      if (newStockLevel === undefined || newStockLevel === null || newStockLevel < 0) {
        return res.status(400).json({ 
          error: "New stock level must be a non-negative number" 
        });
      }
      
      // Get current material from local database
      const material = await storage.getLocalRawMaterial(productId);
      if (!material) {
        return res.status(404).json({ error: "Material not found" });
      }
      
      const previousStock = material.stockQuantity || 0;
      const quantityChange = newStockLevel - previousStock;

      // Update stock in local PostgreSQL
      await storage.updateLocalRawMaterialStock(productId, newStockLevel);

      // Log to stock ledger
      const ledgerEntry = await storage.createStockLedgerEntry({
        materialProductId: productId,
        orderId: null,
        orderNumber: null,
        quantityChange,
        previousStock,
        newStock: newStockLevel,
        reason: "stock_take",
        notes: notes || "Stock take adjustment",
      });

      // Invalidate stock cache
      invalidateStockCache();

      res.json({
        success: true,
        productId,
        productName: material.name,
        previousStock,
        newStock: newStockLevel,
        quantityChange,
        ledgerEntryId: ledgerEntry.id,
      });
    } catch (error: any) {
      console.error("Error setting stock:", error);
      res.status(500).json({ 
        error: error.message || "Failed to set stock level" 
      });
    }
  });

  // Add stock to raw material variation (stock in from suppliers) - uses local PostgreSQL
  app.post("/api/raw-materials/:productId/variations/:variationId/add-stock", requireAuth, async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      const variationId = parseInt(req.params.variationId);
      const { quantity, notes } = req.body;

      if (!quantity || quantity <= 0) {
        return res.status(400).json({ 
          error: "Quantity must be a positive number" 
        });
      }
      
      // Get current variation from local database
      const variation = await storage.getLocalRawMaterialVariation(variationId);
      if (!variation) {
        return res.status(404).json({ error: "Variation not found" });
      }
      
      const previousStock = variation.stockQuantity || 0;
      const newStock = previousStock + quantity;

      // Update stock in local PostgreSQL
      await storage.updateLocalRawMaterialVariationStock(variationId, newStock);

      // Log to stock ledger with variation ID
      const ledgerEntry = await storage.createStockLedgerEntry({
        materialProductId: productId,
        materialVariationId: variationId,
        orderId: null,
        orderNumber: null,
        quantityChange: quantity,
        previousStock,
        newStock,
        reason: "stock_in",
        notes: notes || "Stock received from supplier",
      });

      // Parse variation name from attributes
      let variationName = `Variation ${variationId}`;
      if (variation.attributes) {
        try {
          const attrs = typeof variation.attributes === 'string' ? JSON.parse(variation.attributes) : variation.attributes;
          if (Array.isArray(attrs)) {
            variationName = attrs.map((a: any) => a.option).join(" / ");
          }
        } catch (e) {}
      }

      // Invalidate stock cache
      invalidateStockCache();

      res.json({
        success: true,
        productId,
        variationId,
        variationName,
        previousStock,
        newStock,
        quantityAdded: quantity,
        ledgerEntryId: ledgerEntry.id,
      });
    } catch (error: any) {
      console.error("Error adding variation stock:", error);
      res.status(500).json({ 
        error: error.message || "Failed to add variation stock" 
      });
    }
  });

  // Set absolute stock level for variation (stock take) - uses local PostgreSQL
  app.post("/api/raw-materials/:productId/variations/:variationId/set-stock", requireAuth, async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      const variationId = parseInt(req.params.variationId);
      const { newStockLevel, notes } = req.body;

      if (newStockLevel === undefined || newStockLevel === null || newStockLevel < 0) {
        return res.status(400).json({ 
          error: "New stock level must be a non-negative number" 
        });
      }
      
      // Get current variation from local database
      const variation = await storage.getLocalRawMaterialVariation(variationId);
      if (!variation) {
        return res.status(404).json({ error: "Variation not found" });
      }
      
      const previousStock = variation.stockQuantity || 0;
      const quantityChange = newStockLevel - previousStock;

      // Update stock in local PostgreSQL
      await storage.updateLocalRawMaterialVariationStock(variationId, newStockLevel);

      // Log to stock ledger with variation ID
      const ledgerEntry = await storage.createStockLedgerEntry({
        materialProductId: productId,
        materialVariationId: variationId,
        orderId: null,
        orderNumber: null,
        quantityChange,
        previousStock,
        newStock: newStockLevel,
        reason: "stock_take",
        notes: notes || "Stock take adjustment",
      });

      // Parse variation name from attributes
      let variationName = `Variation ${variationId}`;
      if (variation.attributes) {
        try {
          const attrs = typeof variation.attributes === 'string' ? JSON.parse(variation.attributes) : variation.attributes;
          if (Array.isArray(attrs)) {
            variationName = attrs.map((a: any) => a.option).join(" / ");
          }
        } catch (e) {}
      }

      // Invalidate stock cache
      invalidateStockCache();

      res.json({
        success: true,
        productId,
        variationId,
        variationName,
        previousStock,
        newStock: newStockLevel,
        quantityChange,
        ledgerEntryId: ledgerEntry.id,
      });
    } catch (error: any) {
      console.error("Error setting variation stock:", error);
      res.status(500).json({ 
        error: error.message || "Failed to set variation stock level" 
      });
    }
  });

  // Process order and update local PostgreSQL stock
  app.post("/api/process-order-stock", requireAuth, async (req, res) => {
    try {
      const { orderId, orderNumber, lineItems } = req.body;

      // Check if order was already processed
      const existingProcessed = await storage.getProcessedOrder(orderId);
      if (existingProcessed) {
        return res.status(400).json({ 
          error: "This order has already been processed for inventory",
          processedAt: existingProcessed.processedAt
        });
      }
      
      const results: any[] = [];
      const skippedItems: any[] = [];
      const unmappedItems: any[] = [];
      const failedUpdates: any[] = [];

      // Prefetch all raw materials from local PostgreSQL database
      const allLocalMaterials = await storage.getLocalRawMaterials();
      const materialsMap = new Map(allLocalMaterials.map((m) => [m.id, m]));

      // Log all line items for debugging
      console.log(`[Order ${orderNumber}] Processing ${lineItems.length} line items:`, 
        lineItems.map((i: any) => ({ 
          name: i.name, 
          product_id: i.product_id, 
          variation_id: i.variation_id, 
          quantity: i.quantity 
        }))
      );

      for (let itemIndex = 0; itemIndex < lineItems.length; itemIndex++) {
        const item = lineItems[itemIndex];
        console.log(`[Order ${orderNumber}] Processing line item ${itemIndex + 1}/${lineItems.length}: ${item.name} (product_id=${item.product_id}, variation_id=${item.variation_id}, qty=${item.quantity})`);
        
        const mappings = await storage.getMaterialMappingsForProduct(
          item.product_id, 
          item.variation_id
        );

        console.log(`[Order ${orderNumber}] Found ${mappings.length} mapping(s) for ${item.name}`);

        // Track items without any mappings
        if (mappings.length === 0) {
          console.log(`[Order ${orderNumber}] NO MAPPING for ${item.name} (product_id=${item.product_id}, variation_id=${item.variation_id})`);
          unmappedItems.push({
            productId: item.product_id,
            variationId: item.variation_id,
            name: item.name,
            quantity: item.quantity,
            reason: "No material mapping found for this product/variation"
          });
          continue;
        }

        for (const mapping of mappings) {
          const material = materialsMap.get(mapping.materialProductId);
          
          // Track materials that no longer exist
          if (!material) {
            console.log(`[Order ${orderNumber}] SKIPPED: ${item.name} -> material ID ${mapping.materialProductId} (no longer exists)`);
            skippedItems.push({
              productId: item.product_id,
              variationId: item.variation_id,
              name: item.name,
              materialId: mapping.materialProductId,
              reason: "Material product no longer exists in inventory"
            });
            continue;
          }
          
          // Check if this is a variation mapping
          const isVariationMapping = mapping.materialVariationId !== null && mapping.materialVariationId !== undefined;
          let variation: any = null;
          
          if (isVariationMapping && material.variations) {
            variation = material.variations.find((v: any) => v.id === mapping.materialVariationId);
            if (!variation) {
              console.log(`[Order ${orderNumber}] SKIPPED: ${item.name} -> ${material.name} variation ${mapping.materialVariationId} (variation no longer exists)`);
              skippedItems.push({
                productId: item.product_id,
                variationId: item.variation_id,
                name: item.name,
                materialId: mapping.materialProductId,
                materialVariationId: mapping.materialVariationId,
                reason: "Material variation no longer exists in inventory"
              });
              continue;
            }
          }
          
          // Check stock management - for variations, check the variation's manageStock
          const manageStock = isVariationMapping && variation ? variation.manageStock : material.manageStock;
          if (!manageStock) {
            const displayName = isVariationMapping && variation 
              ? `${material.name} - ${variation.name}` 
              : material.name;
            console.log(`[Order ${orderNumber}] SKIPPED: ${item.name} -> ${displayName} (stock management disabled)`);
            skippedItems.push({
              productId: item.product_id,
              variationId: item.variation_id,
              name: item.name,
              materialId: mapping.materialProductId,
              materialName: displayName,
              reason: "Material does not have stock management enabled"
            });
            continue;
          }
          
          const quantityToDeduct = mapping.quantityUsed * item.quantity;
          
          // Get correct stock based on whether it's a variation or parent material
          const previousStock = isVariationMapping && variation 
            ? (variation.stockQuantity || 0) 
            : (material.stockQuantity || 0);
          const newStock = previousStock - quantityToDeduct;
          
          const displayName = isVariationMapping && variation 
            ? `${material.name} - ${variation.name}` 
            : material.name;

          console.log(`[Order ${orderNumber}] Deducting: ${item.name} -> ${displayName}: ${previousStock} - ${quantityToDeduct} = ${newStock}`);

          try {
            // Update local PostgreSQL stock - use correct function for variation vs parent
            if (isVariationMapping && variation) {
              await storage.updateLocalRawMaterialVariationStock(mapping.materialVariationId!, newStock);
              // Update the variation in memory for subsequent calculations
              variation.stockQuantity = newStock;
            } else {
              await storage.updateLocalRawMaterialStock(mapping.materialProductId, newStock);
              // Update the materialsMap with new stock for subsequent calculations
              material.stockQuantity = newStock;
            }

            const ledgerEntry = await storage.createStockLedgerEntry({
              materialProductId: mapping.materialProductId,
              materialVariationId: mapping.materialVariationId || null,
              orderId,
              orderNumber,
              quantityChange: -quantityToDeduct,
              previousStock,
              newStock,
              reason: "order",
              notes: `Order #${orderNumber} - ${item.name} x${item.quantity}`,
            });

            console.log(`[Order ${orderNumber}] SUCCESS: ${item.name} -> ${displayName} (ledger entry ${ledgerEntry.id})`);

            results.push({
              materialId: mapping.materialProductId,
              materialVariationId: mapping.materialVariationId || null,
              materialName: displayName,
              previousStock,
              newStock,
              quantityDeducted: quantityToDeduct,
              ledgerEntryId: ledgerEntry.id,
              lineItemName: item.name,
            });
          } catch (updateError: any) {
            console.error(`[Order ${orderNumber}] FAILED to update local stock for ${displayName}:`, updateError);
            failedUpdates.push({
              productId: item.product_id,
              variationId: item.variation_id,
              name: item.name,
              materialId: mapping.materialProductId,
              materialName: displayName,
              reason: `Local stock update failed: ${updateError.message || 'Unknown error'}`
            });
          }
        }
      }

      // Mark order as processed
      await storage.markOrderProcessed({ orderId, orderNumber });

      // Invalidate stock cache since materials have changed
      invalidateStockCache();

      // Build response with detailed information about what happened
      const response: any = { 
        success: true, 
        results,
        totalItemsProcessed: results.length,
        totalLineItems: lineItems.length
      };
      
      // Include warnings if some items were skipped
      if (unmappedItems.length > 0) {
        response.unmappedItems = unmappedItems;
        response.warning = `${unmappedItems.length} item(s) had no material mappings and were skipped.`;
      }
      
      if (skippedItems.length > 0) {
        response.skippedItems = skippedItems;
        if (response.warning) {
          response.warning += ` ${skippedItems.length} mapping(s) were skipped due to missing or unmanaged materials.`;
        } else {
          response.warning = `${skippedItems.length} mapping(s) were skipped due to missing or unmanaged materials.`;
        }
      }
      
      if (failedUpdates.length > 0) {
        response.failedUpdates = failedUpdates;
        if (response.warning) {
          response.warning += ` ${failedUpdates.length} stock update(s) failed.`;
        } else {
          response.warning = `${failedUpdates.length} stock update(s) failed.`;
        }
      }

      console.log(`[Order ${orderNumber}] Processing complete. Results: ${results.length}, Unmapped: ${unmappedItems.length}, Skipped: ${skippedItems.length}, Failed: ${failedUpdates.length}`);

      res.json(response);
    } catch (error: any) {
      console.error("Error processing order stock:", error);
      res.status(500).json({ 
        error: error.message || "Failed to process order stock" 
      });
    }
  });

  // ============================================
  // SUPPLIERS ENDPOINTS
  // ============================================

  app.get("/api/suppliers", requireAuth, async (req, res) => {
    try {
      const activeOnly = req.query.activeOnly !== "false";
      const suppliers = await storage.getSuppliers(activeOnly);
      res.json(suppliers);
    } catch (error: any) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ error: error.message || "Failed to fetch suppliers" });
    }
  });

  app.get("/api/suppliers/statistics", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getSupplierStatistics();
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching supplier statistics:", error);
      res.status(500).json({ error: error.message || "Failed to fetch supplier statistics" });
    }
  });

  app.get("/api/suppliers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const supplier = await storage.getSupplier(id);
      if (!supplier) {
        return res.status(404).json({ error: "Supplier not found" });
      }
      res.json(supplier);
    } catch (error: any) {
      console.error("Error fetching supplier:", error);
      res.status(500).json({ error: error.message || "Failed to fetch supplier" });
    }
  });

  app.post("/api/suppliers", requireAuth, async (req, res) => {
    try {
      const validated = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(validated);
      res.status(201).json(supplier);
    } catch (error: any) {
      console.error("Error creating supplier:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid supplier data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Failed to create supplier" });
    }
  });

  app.put("/api/suppliers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = insertSupplierSchema.partial().parse(req.body);
      const supplier = await storage.updateSupplier(id, validated);
      if (!supplier) {
        return res.status(404).json({ error: "Supplier not found" });
      }
      res.json(supplier);
    } catch (error: any) {
      console.error("Error updating supplier:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid supplier data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Failed to update supplier" });
    }
  });

  app.delete("/api/suppliers/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSupplier(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting supplier:", error);
      res.status(500).json({ error: error.message || "Failed to delete supplier" });
    }
  });

  app.get("/api/suppliers/:id/purchase-orders", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const orders = await storage.getSupplierPurchaseOrders(id);
      res.json(orders);
    } catch (error: any) {
      console.error("Error fetching supplier purchase orders:", error);
      res.status(500).json({ error: error.message || "Failed to fetch supplier purchase orders" });
    }
  });

  // ============================================
  // PURCHASE ORDERS ENDPOINTS
  // ============================================

  app.get("/api/purchase-orders", requireAuth, async (req, res) => {
    try {
      const filters = {
        status: req.query.status as string | undefined,
        supplierId: req.query.supplierId ? parseInt(req.query.supplierId as string) : undefined,
        search: req.query.search as string | undefined,
      };
      const orders = await storage.getPurchaseOrders(filters);
      res.json(orders);
    } catch (error: any) {
      console.error("Error fetching purchase orders:", error);
      res.status(500).json({ error: error.message || "Failed to fetch purchase orders" });
    }
  });

  app.get("/api/purchase-orders/next-number", requireAuth, async (req, res) => {
    try {
      const poNumber = await storage.getNextPONumber();
      res.json({ poNumber });
    } catch (error: any) {
      console.error("Error getting next PO number:", error);
      res.status(500).json({ error: error.message || "Failed to get next PO number" });
    }
  });

  app.get("/api/purchase-orders/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const order = await storage.getPurchaseOrder(id);
      if (!order) {
        return res.status(404).json({ error: "Purchase order not found" });
      }
      res.json(order);
    } catch (error: any) {
      console.error("Error fetching purchase order:", error);
      res.status(500).json({ error: error.message || "Failed to fetch purchase order" });
    }
  });

  const createPurchaseOrderSchema = z.object({
    poNumber: z.string(),
    supplierId: z.number(),
    status: z.enum(["draft", "ordered", "partially_received", "received", "cancelled"]).optional(),
    orderDate: z.string().nullable().optional(),
    expectedDeliveryDate: z.string().nullable().optional(),
    shippingCost: z.string().optional(),
    notes: z.string().nullable().optional(),
    items: z.array(z.object({
      materialProductId: z.number(),
      materialVariationId: z.number().nullable().optional(),
      materialName: z.string(),
      quantityOrdered: z.number(),
      unitPrice: z.string(),
      vatRate: z.string(),
    })),
  });

  app.post("/api/purchase-orders", requireAuth, async (req, res) => {
    try {
      const validated = createPurchaseOrderSchema.parse(req.body);
      
      // Calculate line totals and order totals
      let subtotal = 0;
      let vatTotal = 0;
      const items = validated.items.map(item => {
        const lineSubtotal = item.quantityOrdered * parseFloat(item.unitPrice);
        const lineVat = lineSubtotal * (parseFloat(item.vatRate) / 100);
        const lineTotal = lineSubtotal + lineVat;
        
        subtotal += lineSubtotal;
        vatTotal += lineVat;
        
        return {
          purchaseOrderId: 0, // Will be set by storage
          materialProductId: item.materialProductId,
          materialVariationId: item.materialVariationId || null,
          materialName: item.materialName,
          quantityOrdered: item.quantityOrdered,
          quantityReceived: 0,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          lineSubtotal: lineSubtotal.toFixed(2),
          lineVat: lineVat.toFixed(2),
          lineTotal: lineTotal.toFixed(2),
        };
      });

      const shippingCost = parseFloat(validated.shippingCost || "0");
      const grandTotal = subtotal + vatTotal + shippingCost;

      const order = await storage.createPurchaseOrder({
        poNumber: validated.poNumber,
        supplierId: validated.supplierId,
        status: validated.status || "draft",
        orderDate: validated.orderDate ? new Date(validated.orderDate) : null,
        expectedDeliveryDate: validated.expectedDeliveryDate ? new Date(validated.expectedDeliveryDate) : null,
        subtotal: subtotal.toFixed(2),
        shippingCost: shippingCost.toFixed(2),
        vatTotal: vatTotal.toFixed(2),
        grandTotal: grandTotal.toFixed(2),
        notes: validated.notes || null,
      }, items);

      res.status(201).json(order);
    } catch (error: any) {
      console.error("Error creating purchase order:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid purchase order data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Failed to create purchase order" });
    }
  });

  app.put("/api/purchase-orders/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = createPurchaseOrderSchema.partial().parse(req.body);
      
      // Get existing order
      const existing = await storage.getPurchaseOrder(id);
      if (!existing) {
        return res.status(404).json({ error: "Purchase order not found" });
      }

      // Calculate new totals if items provided
      let updateData: any = {
        supplierId: validated.supplierId,
        status: validated.status,
        orderDate: validated.orderDate ? new Date(validated.orderDate) : existing.orderDate,
        expectedDeliveryDate: validated.expectedDeliveryDate ? new Date(validated.expectedDeliveryDate) : existing.expectedDeliveryDate,
        notes: validated.notes !== undefined ? validated.notes : existing.notes,
      };

      let items: any[] | undefined;
      if (validated.items) {
        let subtotal = 0;
        let vatTotal = 0;
        items = validated.items.map(item => {
          const lineSubtotal = item.quantityOrdered * parseFloat(item.unitPrice);
          const lineVat = lineSubtotal * (parseFloat(item.vatRate) / 100);
          const lineTotal = lineSubtotal + lineVat;
          
          subtotal += lineSubtotal;
          vatTotal += lineVat;
          
          return {
            purchaseOrderId: id,
            materialProductId: item.materialProductId,
            materialVariationId: item.materialVariationId || null,
            materialName: item.materialName,
            quantityOrdered: item.quantityOrdered,
            quantityReceived: 0,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            lineSubtotal: lineSubtotal.toFixed(2),
            lineVat: lineVat.toFixed(2),
            lineTotal: lineTotal.toFixed(2),
          };
        });

        const shippingCost = parseFloat(validated.shippingCost || existing.shippingCost);
        const grandTotal = subtotal + vatTotal + shippingCost;

        updateData.subtotal = subtotal.toFixed(2);
        updateData.shippingCost = shippingCost.toFixed(2);
        updateData.vatTotal = vatTotal.toFixed(2);
        updateData.grandTotal = grandTotal.toFixed(2);
      } else if (validated.shippingCost !== undefined) {
        const shippingCost = parseFloat(validated.shippingCost);
        const grandTotal = parseFloat(existing.subtotal) + parseFloat(existing.vatTotal) + shippingCost;
        updateData.shippingCost = shippingCost.toFixed(2);
        updateData.grandTotal = grandTotal.toFixed(2);
      }

      const order = await storage.updatePurchaseOrder(id, updateData, items);
      res.json(order);
    } catch (error: any) {
      console.error("Error updating purchase order:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid purchase order data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Failed to update purchase order" });
    }
  });

  // Add item to draft PO
  app.post("/api/purchase-orders/:id/items", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const order = await storage.getPurchaseOrder(id);
      
      if (!order) {
        return res.status(404).json({ error: "Purchase order not found" });
      }
      
      if (order.status !== "draft") {
        return res.status(400).json({ error: "Can only add items to draft purchase orders" });
      }

      const { materialProductId, materialVariationId, materialName, quantityOrdered, unitPrice, vatRate } = req.body;
      
      const lineSubtotal = quantityOrdered * parseFloat(unitPrice);
      const lineVat = lineSubtotal * (parseFloat(vatRate) / 100);
      const lineTotal = lineSubtotal + lineVat;

      const item = await storage.addPurchaseOrderItem(id, {
        purchaseOrderId: id,
        materialProductId,
        materialVariationId: materialVariationId || null,
        materialName,
        quantityOrdered,
        quantityReceived: 0,
        unitPrice,
        vatRate,
        lineSubtotal: lineSubtotal.toFixed(2),
        lineVat: lineVat.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
      });

      const updatedOrder = await storage.recalculatePurchaseOrderTotals(id);
      res.status(201).json({ item, order: updatedOrder });
    } catch (error: any) {
      console.error("Error adding item to purchase order:", error);
      res.status(500).json({ error: error.message || "Failed to add item" });
    }
  });

  // Remove item from draft PO
  app.delete("/api/purchase-orders/:id/items/:itemId", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      
      const order = await storage.getPurchaseOrder(id);
      if (!order) {
        return res.status(404).json({ error: "Purchase order not found" });
      }
      
      if (order.status !== "draft") {
        return res.status(400).json({ error: "Can only remove items from draft purchase orders" });
      }

      const item = order.items.find(i => i.id === itemId);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      await storage.deletePurchaseOrderItem(itemId);
      const updatedOrder = await storage.recalculatePurchaseOrderTotals(id);
      res.json(updatedOrder);
    } catch (error: any) {
      console.error("Error removing item from purchase order:", error);
      res.status(500).json({ error: error.message || "Failed to remove item" });
    }
  });

  // Update shipping details (cost and VAT)
  app.patch("/api/purchase-orders/:id/shipping", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { shippingCost, shippingVatRate } = req.body;
      
      const order = await storage.getPurchaseOrder(id);
      if (!order) {
        return res.status(404).json({ error: "Purchase order not found" });
      }
      
      if (order.status !== "draft") {
        return res.status(400).json({ error: "Can only update shipping on draft purchase orders" });
      }

      await storage.updatePurchaseOrder(id, {
        shippingCost: parseFloat(shippingCost || "0").toFixed(2),
        shippingVatRate: parseFloat(shippingVatRate || "0").toFixed(2),
      });

      const updatedOrder = await storage.recalculatePurchaseOrderTotals(id);
      res.json(updatedOrder);
    } catch (error: any) {
      console.error("Error updating shipping:", error);
      res.status(500).json({ error: error.message || "Failed to update shipping" });
    }
  });

  app.delete("/api/purchase-orders/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const order = await storage.getPurchaseOrder(id);
      if (!order) {
        return res.status(404).json({ error: "Purchase order not found" });
      }
      
      // Only allow deletion of draft or cancelled orders
      if (order.status !== "draft" && order.status !== "cancelled") {
        return res.status(400).json({ 
          error: "Only draft or cancelled purchase orders can be deleted" 
        });
      }

      await storage.deletePurchaseOrder(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting purchase order:", error);
      res.status(500).json({ error: error.message || "Failed to delete purchase order" });
    }
  });

  // Receive items endpoint - updates local PostgreSQL stock and creates ledger entries
  app.post("/api/purchase-orders/:id/receive", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = receiveItemsRequestSchema.parse(req.body);

      const order = await storage.getPurchaseOrder(id);
      if (!order) {
        return res.status(404).json({ error: "Purchase order not found" });
      }

      if (order.status === "cancelled") {
        return res.status(400).json({ error: "Cannot receive items for a cancelled order" });
      }

      if (order.status === "received") {
        return res.status(400).json({ error: "This order has already been fully received" });
      }

      // Process each item receipt and update local PostgreSQL stock
      const results: any[] = [];
      const validatedReceipts: { itemId: number; quantityReceived: number }[] = [];
      
      for (const receipt of validated.items) {
        const item = order.items.find(i => i.id === receipt.itemId);
        if (!item || receipt.quantityReceived <= 0) continue;

        const remainingToReceive = item.quantityOrdered - item.quantityReceived;
        const quantityToReceive = Math.min(receipt.quantityReceived, remainingToReceive);
        
        if (quantityToReceive <= 0) continue;
        
        // Track the clamped quantities for database update
        validatedReceipts.push({
          itemId: receipt.itemId,
          quantityReceived: quantityToReceive,
        });

        // Update local PostgreSQL stock
        if (item.materialVariationId) {
          // Get current stock from local variation
          const variation = await storage.getLocalRawMaterialVariation(item.materialVariationId);
          const previousStock = variation?.stockQuantity || 0;
          const newStock = previousStock + quantityToReceive;
          
          // Update local variation stock
          await storage.updateLocalRawMaterialVariationStock(item.materialVariationId, newStock);
          
          await storage.createStockLedgerEntry({
            materialProductId: item.materialProductId,
            materialVariationId: item.materialVariationId,
            orderId: null,
            orderNumber: order.poNumber,
            quantityChange: quantityToReceive,
            previousStock,
            newStock,
            reason: "purchase_order",
            notes: `PO ${order.poNumber} - ${item.materialName} received`,
          });

          results.push({
            itemId: item.id,
            materialName: item.materialName,
            quantityReceived: quantityToReceive,
            previousStock,
            newStock,
          });
        } else {
          // Get current stock from local material
          const material = await storage.getLocalRawMaterial(item.materialProductId);
          const previousStock = material?.stockQuantity || 0;
          const newStock = previousStock + quantityToReceive;
          
          // Update local material stock
          await storage.updateLocalRawMaterialStock(item.materialProductId, newStock);
          
          await storage.createStockLedgerEntry({
            materialProductId: item.materialProductId,
            materialVariationId: null,
            orderId: null,
            orderNumber: order.poNumber,
            quantityChange: quantityToReceive,
            previousStock,
            newStock,
            reason: "purchase_order",
            notes: `PO ${order.poNumber} - ${item.materialName} received`,
          });

          results.push({
            itemId: item.id,
            materialName: item.materialName,
            quantityReceived: quantityToReceive,
            previousStock,
            newStock,
          });
        }
      }

      // Update the purchase order items received quantities with clamped values
      const updatedOrder = await storage.receivePurchaseOrderItems(id, validatedReceipts);

      res.json({
        success: true,
        order: updatedOrder,
        results,
      });
    } catch (error: any) {
      console.error("Error receiving purchase order items:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid receive data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Failed to receive items" });
    }
  });

  // Update purchase order status
  app.patch("/api/purchase-orders/:id/status", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      const validStatuses = ["draft", "ordered", "partially_received", "received", "cancelled"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const order = await storage.getPurchaseOrder(id);
      if (!order) {
        return res.status(404).json({ error: "Purchase order not found" });
      }

      const updatedOrder = await storage.updatePurchaseOrder(id, { status });
      res.json(updatedOrder);
    } catch (error: any) {
      console.error("Error updating purchase order status:", error);
      res.status(500).json({ error: error.message || "Failed to update status" });
    }
  });

  // Generate PDF for purchase order
  app.get("/api/purchase-orders/:id/pdf", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const order = await storage.getPurchaseOrder(id);
      
      if (!order) {
        return res.status(404).json({ error: "Purchase order not found" });
      }

      const credentials = await getCredentialsFromStorage();
      const storeName = credentials?.storeUrl ? new URL(credentials.storeUrl).hostname : "Your Company";

      const doc = new PDFDocument({ margin: 50 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${order.poNumber}.pdf"`);
      
      doc.pipe(res);

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text('PURCHASE ORDER', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).font('Helvetica').text(order.poNumber, { align: 'center' });
      doc.moveDown(1.5);

      // From/To section
      const startY = doc.y;
      
      // From (left column)
      doc.fontSize(10).font('Helvetica-Bold').text('FROM:', 50, startY);
      doc.font('Helvetica').text(storeName, 50, startY + 15);
      
      // To (right column)
      doc.font('Helvetica-Bold').text('TO:', 300, startY);
      doc.font('Helvetica').text(order.supplier?.name || 'Unknown Supplier', 300, startY + 15);
      if (order.supplier?.contactName) {
        doc.text(`Attn: ${order.supplier.contactName}`, 300);
      }
      if (order.supplier?.email) {
        doc.text(order.supplier.email, 300);
      }
      if (order.supplier?.phone) {
        doc.text(order.supplier.phone, 300);
      }
      if (order.supplier?.address) {
        doc.text(order.supplier.address, 300);
      }

      doc.moveDown(2);

      // Dates
      const dateY = doc.y;
      const formatDate = (date: Date | string | null) => {
        if (!date) return '-';
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' });
      };
      
      doc.font('Helvetica-Bold').text('Order Date:', 50, dateY);
      doc.font('Helvetica').text(formatDate(order.orderDate), 130, dateY);
      doc.font('Helvetica-Bold').text('Expected Delivery:', 300, dateY);
      doc.font('Helvetica').text(formatDate(order.expectedDeliveryDate), 410, dateY);
      doc.font('Helvetica-Bold').text('Status:', 50, dateY + 20);
      doc.font('Helvetica').text(order.status.replace('_', ' ').toUpperCase(), 130, dateY + 20);

      doc.moveDown(3);

      // Table Header
      const tableTop = doc.y;
      const tableLeft = 50;
      const columnWidths = { item: 200, qty: 50, price: 80, vat: 60, total: 80 };
      
      doc.font('Helvetica-Bold').fontSize(10);
      doc.rect(tableLeft, tableTop, 495, 20).fill('#f3f4f6');
      doc.fillColor('#000');
      doc.text('Item', tableLeft + 5, tableTop + 5);
      doc.text('Qty', tableLeft + columnWidths.item + 5, tableTop + 5, { width: columnWidths.qty, align: 'right' });
      doc.text('Unit Price', tableLeft + columnWidths.item + columnWidths.qty + 5, tableTop + 5, { width: columnWidths.price, align: 'right' });
      doc.text('VAT %', tableLeft + columnWidths.item + columnWidths.qty + columnWidths.price + 5, tableTop + 5, { width: columnWidths.vat, align: 'right' });
      doc.text('Total', tableLeft + columnWidths.item + columnWidths.qty + columnWidths.price + columnWidths.vat + 5, tableTop + 5, { width: columnWidths.total, align: 'right' });

      // Table rows
      doc.font('Helvetica').fontSize(9);
      let rowY = tableTop + 25;
      
      for (const item of order.items) {
        if (rowY > 700) {
          doc.addPage();
          rowY = 50;
        }
        
        doc.text(item.materialName, tableLeft + 5, rowY, { width: columnWidths.item - 10 });
        doc.text(item.quantityOrdered.toString(), tableLeft + columnWidths.item + 5, rowY, { width: columnWidths.qty, align: 'right' });
        doc.text(`€${parseFloat(item.unitPrice).toFixed(2)}`, tableLeft + columnWidths.item + columnWidths.qty + 5, rowY, { width: columnWidths.price, align: 'right' });
        doc.text(`${parseFloat(item.vatRate).toFixed(0)}%`, tableLeft + columnWidths.item + columnWidths.qty + columnWidths.price + 5, rowY, { width: columnWidths.vat, align: 'right' });
        doc.text(`€${parseFloat(item.lineTotal).toFixed(2)}`, tableLeft + columnWidths.item + columnWidths.qty + columnWidths.price + columnWidths.vat + 5, rowY, { width: columnWidths.total, align: 'right' });
        
        rowY += 20;
      }

      // Line separator
      doc.moveTo(tableLeft, rowY).lineTo(tableLeft + 495, rowY).stroke();
      rowY += 15;

      // Totals section
      const totalsX = 370;
      doc.font('Helvetica').fontSize(10);
      
      doc.text('Subtotal:', totalsX, rowY);
      doc.text(`€${parseFloat(order.subtotal).toFixed(2)}`, totalsX + 80, rowY, { width: 75, align: 'right' });
      rowY += 18;

      doc.text('Items VAT:', totalsX, rowY);
      const itemsVat = parseFloat(order.vatTotal) - parseFloat(order.shippingVat || '0');
      doc.text(`€${itemsVat.toFixed(2)}`, totalsX + 80, rowY, { width: 75, align: 'right' });
      rowY += 18;

      doc.text('Shipping:', totalsX, rowY);
      doc.text(`€${parseFloat(order.shippingCost).toFixed(2)}`, totalsX + 80, rowY, { width: 75, align: 'right' });
      rowY += 18;

      const shippingVat = parseFloat(order.shippingVat || '0');
      if (shippingVat > 0) {
        doc.text('Shipping VAT:', totalsX, rowY);
        doc.text(`€${shippingVat.toFixed(2)}`, totalsX + 80, rowY, { width: 75, align: 'right' });
        rowY += 18;
      }

      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('Grand Total:', totalsX, rowY);
      doc.text(`€${parseFloat(order.grandTotal).toFixed(2)}`, totalsX + 80, rowY, { width: 75, align: 'right' });

      // Notes section
      if (order.notes) {
        rowY += 40;
        doc.font('Helvetica-Bold').fontSize(10).text('Notes:', tableLeft, rowY);
        doc.font('Helvetica').text(order.notes, tableLeft, rowY + 15, { width: 495 });
      }

      // Footer
      doc.fontSize(8).font('Helvetica').fillColor('#666');
      doc.text(
        `Generated on ${new Date().toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        50,
        750,
        { align: 'center' }
      );

      doc.end();
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: error.message || "Failed to generate PDF" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
