import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "./status-badge";
import { format } from "date-fns";
import { Package, User, MapPin, CreditCard, Truck, Box, CheckCircle, Loader2, RefreshCw, ExternalLink, AlertTriangle, Layers } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCredentials } from "@/contexts/credentials-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { Order, OrderStatus } from "@shared/schema";

interface RequiredMaterial {
  materialId: number;
  variationId: number | null;
  materialName: string;
  quantityNeeded: number;
  currentStock: number;
  hasSufficientStock: boolean;
  productName: string;
  variationName: string | null;
}

interface RequiredMaterialsResponse {
  orderId: number;
  orderNumber: string;
  isProcessed: boolean;
  processedAt: string | null;
  requiredMaterials: RequiredMaterial[];
  canFulfill: boolean;
}

// Helper function to get meta data value from order
function getOrderMeta(order: Order, key: string): string | undefined {
  if (!order.meta_data) return undefined;
  const meta = order.meta_data.find(m => m.key === key);
  return meta?.value?.toString();
}

interface OrderDetailsDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderDetailsDialog({ order, open, onOpenChange }: OrderDetailsDialogProps) {
  const { hasCredentials } = useCredentials();
  const { toast } = useToast();
  const [currentStatus, setCurrentStatus] = useState<string>("");
  
  useEffect(() => {
    if (order) {
      setCurrentStatus(order.status);
    }
  }, [order]);
  
  const { data: orderStatuses = [] } = useQuery<OrderStatus[]>({
    queryKey: ["/api/order-statuses"],
    enabled: hasCredentials && open,
  });
  
  const { data: processedStatus, isLoading: checkingProcessed } = useQuery({
    queryKey: ["/api/processed-orders", order?.id],
    enabled: !!order && open,
    queryFn: async () => {
      const response = await fetch(`/api/processed-orders/${order?.id}`);
      if (!response.ok) throw new Error("Failed to check processed status");
      return response.json();
    },
  });

  const { data: requiredMaterials, isLoading: loadingMaterials } = useQuery<RequiredMaterialsResponse>({
    queryKey: ["/api/orders", order?.id, "required-materials"],
    enabled: !!order && open && hasCredentials,
    queryFn: async () => {
      const response = await fetch(`/api/orders/${order?.id}/required-materials`);
      if (!response.ok) throw new Error("Failed to fetch required materials");
      return response.json();
    },
  });
  
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!order) throw new Error("No order selected");
      
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update status");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentStatus(data.status);
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-statuses"] });
      toast({
        title: "Status Updated",
        description: `Order #${order?.number} status changed to ${data.status}.`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update order status.",
      });
    },
  });

  const processInventoryMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error("No order selected");
      
      const response = await fetch("/api/process-order-stock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.number,
          lineItems: order.line_items.map(item => ({
            product_id: item.product_id,
            variation_id: (item as any).variation_id,
            quantity: item.quantity,
            name: item.name,
          })),
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to process inventory");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/processed-orders", order?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/local-materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/fulfillment-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders", order?.id, "required-materials"] });
      
      const deductionsCount = data.results?.length || 0;
      const unmappedCount = data.unmappedItems?.length || 0;
      const skippedCount = data.skippedItems?.length || 0;
      const failedCount = data.failedUpdates?.length || 0;
      
      // Show warning toast if some items weren't processed
      if (unmappedCount > 0 || skippedCount > 0 || failedCount > 0) {
        const unmappedNames = data.unmappedItems?.map((i: any) => i.name).join(", ") || "";
        const skippedNames = data.skippedItems?.map((i: any) => i.name).join(", ") || "";
        const failedNames = data.failedUpdates?.map((i: any) => `${i.name} → ${i.materialName}`).join(", ") || "";
        
        let warningDesc = `Processed ${deductionsCount} material deduction(s).`;
        if (unmappedCount > 0) {
          warningDesc += ` ${unmappedCount} item(s) had no mappings: ${unmappedNames}.`;
        }
        if (skippedCount > 0) {
          warningDesc += ` ${skippedCount} mapping(s) skipped: ${skippedNames}.`;
        }
        if (failedCount > 0) {
          warningDesc += ` ${failedCount} update(s) failed: ${failedNames}.`;
        }
        
        toast({
          variant: "destructive",
          title: "Partial Processing",
          description: warningDesc,
          duration: 10000,
        });
      } else {
        toast({
          title: "Inventory Processed",
          description: deductionsCount > 0 
            ? `Successfully deducted stock for ${deductionsCount} material(s).`
            : "Order processed. No materials were linked to these products.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Processing Failed",
        description: error.message || "Failed to process inventory for this order.",
      });
    },
  });

  if (!order) return null;

  const subtotal = order.line_items.reduce((sum, item) => sum + parseFloat(item.total || "0"), 0);
  const shippingTotal = parseFloat(order.shipping_total || "0");
  const taxTotal = parseFloat(order.total_tax || "0");
  const discountTotal = parseFloat(order.discount_total || "0");
  const total = parseFloat(order.total);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-order-details">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-2xl">Order #{order.number}</DialogTitle>
            <div className="flex items-center gap-2">
              {hasCredentials && orderStatuses.length > 0 ? (
                <div className="flex items-center gap-2">
                  <Select
                    value={currentStatus}
                    onValueChange={(value) => updateStatusMutation.mutate(value)}
                    disabled={updateStatusMutation.isPending}
                  >
                    <SelectTrigger className="w-[180px]" data-testid="select-order-status">
                      <SelectValue>
                        <StatusBadge status={currentStatus} />
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {orderStatuses.map((status) => (
                        <SelectItem key={status.slug} value={status.slug}>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={status.slug} />
                            <span className="text-xs text-muted-foreground">({status.total})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {updateStatusMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              ) : (
                <StatusBadge status={currentStatus || order.status} />
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Placed on {format(new Date(order.date_created), "MMMM dd, yyyy 'at' h:mm a")}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Information */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Customer Information</h3>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div>
                <p className="font-medium">
                  {order.billing.first_name} {order.billing.last_name}
                </p>
                <p className="text-sm text-muted-foreground">{order.billing.email}</p>
                {order.billing.phone && (
                  <p className="text-sm text-muted-foreground">{order.billing.phone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Billing Address */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Billing Address</h3>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm">
                {order.billing.address_1}
                {order.billing.address_2 && (
                  <>
                    <br />
                    {order.billing.address_2}
                  </>
                )}
                <br />
                {order.billing.city}, {order.billing.state} {order.billing.postcode}
                <br />
                {order.billing.country}
              </p>
            </div>
          </div>

          {/* Shipping Address */}
          {order.shipping && (order.shipping.address_1 || order.shipping.first_name) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Shipping Address</h3>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                {order.shipping.first_name && (
                  <p className="font-medium mb-1">
                    {order.shipping.first_name} {order.shipping.last_name}
                  </p>
                )}
                <p className="text-sm">
                  {order.shipping.address_1}
                  {order.shipping.address_2 && (
                    <>
                      <br />
                      {order.shipping.address_2}
                    </>
                  )}
                  <br />
                  {order.shipping.city}, {order.shipping.state} {order.shipping.postcode}
                  <br />
                  {order.shipping.country}
                </p>
              </div>
            </div>
          )}

          {/* Delivery Information */}
          {(getOrderMeta(order, 'delivery_shipping_partner') || getOrderMeta(order, 'delivery_tracking_number')) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Delivery Information</h3>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                {getOrderMeta(order, 'delivery_shipping_partner') && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Shipping Partner:</span>
                    <span className="text-sm font-medium">{getOrderMeta(order, 'delivery_shipping_partner')}</span>
                  </div>
                )}
                {getOrderMeta(order, 'delivery_tracking_number') && (() => {
                  const trackingNumber = getOrderMeta(order, 'delivery_tracking_number');
                  const shippingPartner = getOrderMeta(order, 'delivery_shipping_partner');
                  const isAnPost = shippingPartner?.toLowerCase().includes('an post');
                  
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Tracking Number:</span>
                      {isAnPost ? (
                        <a 
                          href={`https://www.anpost.com/Post-Parcels/Track/History?item=${trackingNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-mono font-medium text-primary hover:underline flex items-center gap-1"
                          data-testid="link-tracking-detail"
                        >
                          {trackingNumber}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-sm font-mono font-medium">
                          {trackingNumber}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Order Items */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Order Items</h3>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 text-sm font-semibold">Product</th>
                    <th className="text-center p-3 text-sm font-semibold">Quantity</th>
                    <th className="text-right p-3 text-sm font-semibold">Price</th>
                    <th className="text-right p-3 text-sm font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.line_items.map((item) => {
                    const variationAttributes = item.meta_data?.filter(
                      (meta) => {
                        if (!meta.display_key || !meta.display_value) return false;
                        if (meta.key.startsWith('_')) return false;
                        if (typeof meta.display_value === 'object') return false;
                        return true;
                      }
                    ) || [];
                    
                    return (
                      <tr key={item.id} className="border-t" data-testid={`row-line-item-${item.id}`}>
                        <td className="p-3">
                          <p className="font-medium">{item.name}</p>
                          {item.sku && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              SKU: {item.sku}
                            </p>
                          )}
                          {variationAttributes.length > 0 && (
                            <div className="mt-1.5 space-y-0.5">
                              {variationAttributes.map((attr) => (
                                <p 
                                  key={attr.id} 
                                  className="text-sm text-muted-foreground"
                                  data-testid={`text-variation-${attr.key}`}
                                >
                                  <span className="font-medium">{attr.display_key}:</span>{" "}
                                  <span>{String(attr.display_value)}</span>
                                </p>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center align-top">{item.quantity}</td>
                        <td className="p-3 text-right align-top">
                          € {item.price ? item.price.toFixed(2) : (parseFloat(item.total) / item.quantity).toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-medium align-top">
                          € {parseFloat(item.total).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Totals */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Order Summary</h3>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>€ {subtotal.toFixed(2)}</span>
              </div>

              {discountTotal > 0 && (
                <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                  <span>Discount</span>
                  <span>-€ {discountTotal.toFixed(2)}</span>
                </div>
              )}

              {order.shipping_lines && order.shipping_lines.length > 0 ? (
                order.shipping_lines.map((shipping) => (
                  <div key={shipping.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{shipping.method_title}</span>
                    <span>€ {parseFloat(shipping.total).toFixed(2)}</span>
                  </div>
                ))
              ) : shippingTotal > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>€ {shippingTotal.toFixed(2)}</span>
                </div>
              ) : null}

              {taxTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>€ {taxTotal.toFixed(2)}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>€ {total.toFixed(2)}</span>
              </div>

              {order.payment_method_title && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    Payment method: <span className="font-medium text-foreground">{order.payment_method_title}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Required Raw Materials */}
          {hasCredentials && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Required Raw Materials</h3>
                {requiredMaterials && (
                  requiredMaterials.canFulfill ? (
                    <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Stock Available
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Insufficient Stock
                    </Badge>
                  )
                )}
              </div>
              
              {loadingMaterials ? (
                <div className="flex items-center justify-center py-4 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading materials...
                </div>
              ) : requiredMaterials?.requiredMaterials && requiredMaterials.requiredMaterials.length > 0 ? (
                <div className="bg-muted/50 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-2 font-medium">Material</th>
                        <th className="text-center p-2 font-medium">Needed</th>
                        <th className="text-center p-2 font-medium">In Stock</th>
                        <th className="text-center p-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requiredMaterials.requiredMaterials.map((material, index) => (
                        <tr 
                          key={`${material.materialId}-${material.variationId || 'null'}-${index}`} 
                          className="border-b last:border-0"
                          data-testid={`row-material-${material.materialId}`}
                        >
                          <td className="p-2">
                            <div className="font-medium">{material.materialName}</div>
                            <div className="text-xs text-muted-foreground">{material.productName}</div>
                          </td>
                          <td className="p-2 text-center font-medium">{material.quantityNeeded}</td>
                          <td className="p-2 text-center">{material.currentStock}</td>
                          <td className="p-2 text-center">
                            {material.hasSufficientStock ? (
                              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-4 text-center bg-muted/50 rounded-lg">
                  No materials mapped to products in this order
                </div>
              )}
            </div>
          )}

          {/* Inventory Processing */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Inventory Processing</span>
              </div>
              {!hasCredentials ? (
                <span className="text-xs text-muted-foreground">
                  Configure WooCommerce in Settings to enable
                </span>
              ) : checkingProcessed ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : processedStatus?.processed ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">
                    Processed on {format(new Date(processedStatus.data.processedAt), "MMM d, yyyy")}
                  </span>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => processInventoryMutation.mutate()}
                  disabled={processInventoryMutation.isPending}
                  data-testid="button-process-inventory"
                >
                  {processInventoryMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Box className="mr-2 h-4 w-4" />
                      Process Inventory
                    </>
                  )}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {hasCredentials 
                ? "Processing will deduct raw materials based on your product mappings."
                : "Set up your WooCommerce API credentials to process inventory."}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
