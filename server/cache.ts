/**
 * Simple in-memory cache with TTL (time-to-live) support
 * Used to cache WooCommerce API responses to reduce external API calls
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  
  /**
   * Get a value from cache
   * Returns undefined if not found or expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.data as T;
  }
  
  /**
   * Set a value in cache with TTL in seconds
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlSeconds * 1000),
    });
  }
  
  /**
   * Delete a specific cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  /**
   * Clear all entries matching a prefix
   */
  clearByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache stats for debugging
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  ORDERS: 60,           // 1 minute - orders change frequently
  RAW_MATERIALS: 120,   // 2 minutes - stock levels change occasionally
  CATEGORIES: 300,      // 5 minutes - categories rarely change
  ORDER_STATUSES: 300,  // 5 minutes - statuses rarely change
  PRODUCTS: 120,        // 2 minutes - product data changes occasionally
  CUSTOMERS: 120,       // 2 minutes - customer data changes occasionally
};

// Single cache instance
export const apiCache = new MemoryCache();

// Cache key generators
export const cacheKeys = {
  orders: (dateRange: string, status?: string) => 
    `orders:${dateRange}:${status || 'any'}`,
  rawMaterials: () => 'raw-materials',
  categories: () => 'categories',
  orderStatuses: () => 'order-statuses',
  productVariations: (productId: number) => `product-variations:${productId}`,
  fulfillmentStatus: (dateRange: string) => `fulfillment-status:${dateRange}`,
  customers: () => 'customers',
};

/**
 * Invalidate cache entries related to inventory/stock changes
 * Call this after stock updates, order processing, etc.
 */
export function invalidateStockCache(): void {
  console.log('[Cache] Invalidating stock-related cache entries...');
  apiCache.delete(cacheKeys.rawMaterials());
  apiCache.clearByPrefix('fulfillment-status:');
  console.log('[Cache] Stock cache invalidated');
}

/**
 * Invalidate all order-related cache entries
 * Call this after order status changes, new orders, etc.
 */
export function invalidateOrdersCache(): void {
  console.log('[Cache] Invalidating order-related cache entries...');
  apiCache.clearByPrefix('orders:');
  apiCache.clearByPrefix('fulfillment-status:');
  console.log('[Cache] Orders cache invalidated');
}

/**
 * Invalidate all WooCommerce cache entries
 * Use for full refresh
 */
export function invalidateAllCache(): void {
  console.log('[Cache] Clearing all cache entries...');
  apiCache.clear();
  console.log('[Cache] All cache cleared');
}
