import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import { apiCache, cacheKeys, CACHE_TTL } from "./cache";

const WooCommerce = WooCommerceRestApi.default || WooCommerceRestApi;

const EXCLUDED_ORDER_STATUSES = ["checkout-draft"];

export interface WooCommerceCredentials {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

export function createWooCommerceClient(credentials: WooCommerceCredentials) {
  return new WooCommerce({
    url: credentials.storeUrl,
    consumerKey: credentials.consumerKey,
    consumerSecret: credentials.consumerSecret,
    version: "wc/v3",
  });
}

export async function fetchOrders(
  credentials: WooCommerceCredentials,
  params: {
    after?: string;
    before?: string;
    status?: string;
    per_page?: number;
    page?: number;
  } = {}
) {
  // Build cache key from params
  const cacheKey = cacheKeys.orders(params.after || 'all', params.status);
  
  // Check cache first
  const cached = apiCache.get<any[]>(cacheKey);
  if (cached) {
    console.log(`[Cache HIT] orders - ${cacheKey}`);
    return cached;
  }
  
  console.log(`[Cache MISS] orders - ${cacheKey}`);
  const client = createWooCommerceClient(credentials);
  
  try {
    const response = await client.get("orders", {
      per_page: params.per_page || 100,
      page: params.page || 1,
      after: params.after,
      before: params.before,
      status: params.status || "any",
    });
    
    // Filter out excluded statuses (e.g., checkout-draft which are incomplete checkout sessions)
    const filteredOrders = response.data.filter(
      (order: any) => !EXCLUDED_ORDER_STATUSES.includes(order.status)
    );
    
    // Cache the result
    apiCache.set(cacheKey, filteredOrders, CACHE_TTL.ORDERS);
    
    return filteredOrders;
  } catch (error: any) {
    console.error("WooCommerce API Error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to fetch orders from WooCommerce");
  }
}

export async function fetchOrderStatuses(credentials: WooCommerceCredentials) {
  const cacheKey = cacheKeys.orderStatuses();
  
  // Check cache first
  const cached = apiCache.get<any[]>(cacheKey);
  if (cached) {
    console.log(`[Cache HIT] order-statuses`);
    return cached;
  }
  
  console.log(`[Cache MISS] order-statuses`);
  const client = createWooCommerceClient(credentials);
  
  try {
    const response = await client.get("reports/orders/totals");
    const result = response.data
      .filter((status: any) => !EXCLUDED_ORDER_STATUSES.includes(status.slug))
      .map((status: any) => ({
        slug: status.slug,
        name: status.name,
        total: status.total,
      }));
    
    // Cache the result
    apiCache.set(cacheKey, result, CACHE_TTL.ORDER_STATUSES);
    
    return result;
  } catch (error: any) {
    console.error("WooCommerce API Error fetching statuses:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to fetch order statuses");
  }
}

export async function fetchCategories(credentials: WooCommerceCredentials) {
  const client = createWooCommerceClient(credentials);
  
  try {
    const response = await client.get("products/categories", {
      per_page: 100,
    });
    return response.data;
  } catch (error: any) {
    console.error("WooCommerce API Error fetching categories:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to fetch categories");
  }
}

export async function fetchProductsByCategory(
  credentials: WooCommerceCredentials, 
  categoryId: number
) {
  const client = createWooCommerceClient(credentials);
  
  try {
    const response = await client.get("products", {
      category: categoryId,
      per_page: 100,
      status: "publish",
    });
    return response.data;
  } catch (error: any) {
    console.error("WooCommerce API Error fetching products:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to fetch products");
  }
}

export async function fetchRawMaterials(credentials: WooCommerceCredentials) {
  const cacheKey = cacheKeys.rawMaterials();
  
  // Check cache first
  const cached = apiCache.get<any[]>(cacheKey);
  if (cached) {
    console.log(`[Cache HIT] raw-materials`);
    return cached;
  }
  
  console.log(`[Cache MISS] raw-materials - fetching from WooCommerce (this may take a while)...`);
  const client = createWooCommerceClient(credentials);
  
  try {
    const categoriesResponse = await client.get("products/categories", {
      per_page: 100,
    });
    
    const rawMaterialsCategory = categoriesResponse.data.find(
      (cat: any) => cat.slug === "raw-materials" || cat.name.toLowerCase() === "raw materials"
    );
    
    if (!rawMaterialsCategory) {
      return [];
    }
    
    const childCategories = categoriesResponse.data.filter(
      (cat: any) => cat.parent === rawMaterialsCategory.id
    );
    
    const categoryIds = [rawMaterialsCategory.id, ...childCategories.map((c: any) => c.id)];
    
    let allProducts: any[] = [];
    for (const catId of categoryIds) {
      // Fetch published products
      const publishedResponse = await client.get("products", {
        category: catId,
        per_page: 100,
        status: "publish",
      });
      allProducts = [...allProducts, ...publishedResponse.data];
      
      // Also fetch private products (raw materials hidden from storefront)
      const privateResponse = await client.get("products", {
        category: catId,
        per_page: 100,
        status: "private",
      });
      allProducts = [...allProducts, ...privateResponse.data];
    }
    
    const uniqueProducts = Array.from(
      new Map(allProducts.map((p: any) => [p.id, p])).values()
    );
    
    // For variable products, fetch their variations
    const productsWithVariations = await Promise.all(
      uniqueProducts.map(async (product: any) => {
        const baseProduct = {
          id: product.id,
          name: product.name,
          type: product.type === "variable" ? "variable" : "simple",
          sku: product.sku || "",
          stock_quantity: product.stock_quantity,
          stock_status: product.stock_status,
          manage_stock: product.manage_stock,
          categories: product.categories,
          images: product.images,
        };
        
        // If variable product, fetch variations with stock data
        if (product.type === "variable") {
          try {
            const variationsResponse = await client.get(`products/${product.id}/variations`, {
              per_page: 100,
            });
            
            const variations = variationsResponse.data.map((v: any) => ({
              id: v.id,
              parentId: product.id,
              name: v.attributes?.map((a: any) => a.option).join(" / ") || `Variation ${v.id}`,
              sku: v.sku || "",
              stock_quantity: v.stock_quantity,
              stock_status: v.stock_status,
              manage_stock: v.manage_stock,
              attributes: v.attributes || [],
            }));
            
            // Calculate total stock from variations
            const totalStock = variations.reduce(
              (sum: number, v: any) => sum + (v.stock_quantity || 0), 
              0
            );
            
            return {
              ...baseProduct,
              stock_quantity: totalStock,
              variations,
            };
          } catch (err) {
            console.error(`Failed to fetch variations for product ${product.id}:`, err);
            return baseProduct;
          }
        }
        
        return baseProduct;
      })
    );
    
    // Cache the result
    apiCache.set(cacheKey, productsWithVariations, CACHE_TTL.RAW_MATERIALS);
    console.log(`[Cache SET] raw-materials - cached ${productsWithVariations.length} materials`);
    
    return productsWithVariations;
  } catch (error: any) {
    console.error("WooCommerce API Error fetching raw materials:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to fetch raw materials");
  }
}

export async function fetchVariableProducts(credentials: WooCommerceCredentials) {
  const client = createWooCommerceClient(credentials);
  
  try {
    // Fetch published variable products
    const publishedResponse = await client.get("products", {
      type: "variable",
      per_page: 100,
      status: "publish",
    });
    
    // Also fetch private variable products (raw materials hidden from storefront)
    const privateResponse = await client.get("products", {
      type: "variable",
      per_page: 100,
      status: "private",
    });
    
    const allProducts = [...publishedResponse.data, ...privateResponse.data];
    
    return allProducts.map((product: any) => ({
      id: product.id,
      name: product.name,
      type: product.type,
      sku: product.sku || "",
      variations: product.variations || [],
    }));
  } catch (error: any) {
    console.error("WooCommerce API Error fetching variable products:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to fetch variable products");
  }
}

export async function fetchProductVariations(credentials: WooCommerceCredentials, productId: number) {
  const client = createWooCommerceClient(credentials);
  
  try {
    const response = await client.get(`products/${productId}/variations`, {
      per_page: 100,
    });
    
    return response.data.map((variation: any) => ({
      id: variation.id,
      sku: variation.sku || "",
      attributes: variation.attributes || [],
      name: variation.attributes?.map((a: any) => a.option).join(" - ") || `Variation ${variation.id}`,
    }));
  } catch (error: any) {
    console.error("WooCommerce API Error fetching variations:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to fetch product variations");
  }
}

export async function fetchAllProductsWithVariations(credentials: WooCommerceCredentials) {
  const client = createWooCommerceClient(credentials);
  
  try {
    const publishedResponse = await client.get("products", {
      type: "variable",
      per_page: 100,
      status: "publish",
    });
    
    const privateResponse = await client.get("products", {
      type: "variable",
      per_page: 100,
      status: "private",
    });
    
    const allProducts = [...publishedResponse.data, ...privateResponse.data];
    
    const productsWithVariations = await Promise.all(
      allProducts.map(async (product: any) => {
        try {
          const variationsResponse = await client.get(`products/${product.id}/variations`, {
            per_page: 100,
          });
          
          const variations = variationsResponse.data.map((variation: any) => ({
            id: variation.id,
            sku: variation.sku || "",
            attributes: variation.attributes || [],
            name: variation.attributes?.map((a: any) => a.option).join(" - ") || `Variation ${variation.id}`,
          }));
          
          return {
            id: product.id,
            name: product.name,
            type: product.type,
            sku: product.sku || "",
            variations,
          };
        } catch (err) {
          console.error(`Failed to fetch variations for product ${product.id}:`, err);
          return {
            id: product.id,
            name: product.name,
            type: product.type,
            sku: product.sku || "",
            variations: [],
          };
        }
      })
    );
    
    return productsWithVariations;
  } catch (error: any) {
    console.error("WooCommerce API Error fetching products with variations:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to fetch products with variations");
  }
}

export async function updateProductStock(
  credentials: WooCommerceCredentials,
  productId: number,
  stockQuantity: number
) {
  const client = createWooCommerceClient(credentials);
  
  try {
    const response = await client.put(`products/${productId}`, {
      stock_quantity: stockQuantity,
      manage_stock: true,
    });
    return response.data;
  } catch (error: any) {
    console.error("WooCommerce API Error updating stock:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to update product stock");
  }
}

export async function updateVariationStock(
  credentials: WooCommerceCredentials,
  productId: number,
  variationId: number,
  stockQuantity: number
) {
  const client = createWooCommerceClient(credentials);
  
  try {
    const response = await client.put(`products/${productId}/variations/${variationId}`, {
      stock_quantity: stockQuantity,
      manage_stock: true,
    });
    return response.data;
  } catch (error: any) {
    console.error("WooCommerce API Error updating variation stock:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to update variation stock");
  }
}

export async function getVariationById(
  credentials: WooCommerceCredentials,
  productId: number,
  variationId: number
) {
  const client = createWooCommerceClient(credentials);
  
  try {
    const response = await client.get(`products/${productId}/variations/${variationId}`);
    return response.data;
  } catch (error: any) {
    console.error("WooCommerce API Error fetching variation:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to fetch variation");
  }
}

export async function updateOrderStatus(
  credentials: WooCommerceCredentials,
  orderId: number,
  status: string
) {
  const client = createWooCommerceClient(credentials);
  
  try {
    const response = await client.put(`orders/${orderId}`, {
      status: status,
    });
    return response.data;
  } catch (error: any) {
    console.error("WooCommerce API Error updating order:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to update order status");
  }
}

export async function getProductById(
  credentials: WooCommerceCredentials,
  productId: number
) {
  const client = createWooCommerceClient(credentials);
  
  try {
    const response = await client.get(`products/${productId}`);
    return response.data;
  } catch (error: any) {
    console.error("WooCommerce API Error fetching product:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to fetch product");
  }
}

export async function getOrderStats(orders: any[]) {
  const totalRevenue = orders.reduce((sum, order) => {
    return sum + parseFloat(order.total || "0");
  }, 0);

  const totalOrders = orders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const ordersByStatus = orders.reduce((acc, order) => {
    const status = order.status || "unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalRevenue,
    totalOrders,
    averageOrderValue,
    ordersByStatus,
  };
}

export function getDateRange(preset: string): { after: string; before?: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (preset) {
    case "today":
      return {
        after: today.toISOString(),
      };
    
    case "last7days":
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      return {
        after: sevenDaysAgo.toISOString(),
      };
    
    case "last30days":
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      return {
        after: thirtyDaysAgo.toISOString(),
      };
    
    case "last90days":
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(today.getDate() - 90);
      return {
        after: ninetyDaysAgo.toISOString(),
      };
    
    default:
      const defaultDaysAgo = new Date(today);
      defaultDaysAgo.setDate(today.getDate() - 30);
      return {
        after: defaultDaysAgo.toISOString(),
      };
  }
}

export function generateOrderTrends(orders: any[]): Array<{ date: string; orders: number; revenue: number }> {
  const trendMap = new Map<string, { orders: number; revenue: number }>();

  orders.forEach((order) => {
    const date = new Date(order.date_created).toISOString().split("T")[0];
    const existing = trendMap.get(date) || { orders: 0, revenue: 0 };
    
    trendMap.set(date, {
      orders: existing.orders + 1,
      revenue: existing.revenue + parseFloat(order.total || "0"),
    });
  });

  return Array.from(trendMap.entries())
    .map(([date, data]) => ({
      date,
      orders: data.orders,
      revenue: Math.round(data.revenue * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface Customer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  is_paying_customer: boolean;
  avatar_url: string;
  date_created: string;
  date_modified: string;
  orders_count?: number;
  total_spent?: string;
}

export async function fetchCustomers(
  credentials: WooCommerceCredentials,
  params: {
    per_page?: number;
    page?: number;
    search?: string;
    role?: string;
  } = {}
): Promise<Customer[]> {
  const cacheKey = cacheKeys.customers();
  
  // Only use cache if no search param (cache full list only)
  if (!params.search) {
    const cached = apiCache.get<Customer[]>(cacheKey);
    if (cached) {
      console.log(`[Cache HIT] customers`);
      return cached;
    }
  }
  
  console.log(`[Cache MISS] customers - fetching from WooCommerce...`);
  const client = createWooCommerceClient(credentials);
  
  try {
    // Fetch all customers with pagination
    let allCustomers: Customer[] = [];
    let page = 1;
    const perPage = params.per_page || 100;
    let hasMore = true;
    
    while (hasMore) {
      const response = await client.get("customers", {
        per_page: perPage,
        page: page,
        role: params.role || "all",
        search: params.search,
      });
      
      allCustomers = [...allCustomers, ...response.data];
      
      // Check if there are more pages
      const totalPages = parseInt(response.headers['x-wp-totalpages'] || '1');
      hasMore = page < totalPages;
      page++;
      
      // Safety limit to prevent infinite loops
      if (page > 50) break;
    }
    
    // Cache only the full list (no search)
    if (!params.search) {
      apiCache.set(cacheKey, allCustomers, CACHE_TTL.CUSTOMERS);
      console.log(`[Cache SET] customers - cached ${allCustomers.length} customers`);
    }
    
    return allCustomers;
  } catch (error: any) {
    console.error("WooCommerce API Error fetching customers:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to fetch customers from WooCommerce");
  }
}

export async function fetchCustomerById(
  credentials: WooCommerceCredentials,
  customerId: number
): Promise<Customer> {
  const client = createWooCommerceClient(credentials);
  
  try {
    const response = await client.get(`customers/${customerId}`);
    return response.data;
  } catch (error: any) {
    console.error("WooCommerce API Error fetching customer:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to fetch customer");
  }
}

export async function fetchCustomerOrders(
  credentials: WooCommerceCredentials,
  customerId: number
): Promise<any[]> {
  const client = createWooCommerceClient(credentials);
  
  try {
    const response = await client.get("orders", {
      customer: customerId,
      per_page: 100,
    });
    return response.data;
  } catch (error: any) {
    console.error("WooCommerce API Error fetching customer orders:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to fetch customer orders");
  }
}
