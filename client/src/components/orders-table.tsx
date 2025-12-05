import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "./status-badge";
import { OrderDetailsDialog } from "./order-details-dialog";
import { Download, Search, FileText, Truck, ExternalLink, CheckCircle, Circle } from "lucide-react";
import type { Order, OrderStatus } from "@shared/schema";
import { format } from "date-fns";

interface FulfillmentStatus {
  canFulfill: boolean;
  missingMaterials: Array<{
    materialId: number;
    variationId: number | null;
    materialName: string;
    needed: number;
    available: number;
  }>;
  isProcessed: boolean;
}

// Helper function to get meta data value from order
function getOrderMeta(order: Order, key: string): string | undefined {
  if (!order.meta_data) return undefined;
  const meta = order.meta_data.find(m => m.key === key);
  return meta?.value?.toString();
}

interface OrdersTableProps {
  orders: Order[];
  isLoading?: boolean;
  onExport: (filters: { status?: string; search?: string }) => void;
}

export function OrdersTable({ orders, isLoading, onExport }: OrdersTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: orderStatuses } = useQuery<OrderStatus[]>({
    queryKey: ["/api/order-statuses"],
    enabled: true,
  });

  const { data: fulfillmentStatus } = useQuery<Record<number, FulfillmentStatus>>({
    queryKey: ["/api/orders/fulfillment-status"],
    enabled: orders.length > 0,
    staleTime: 30000,
  });

  const handleExport = () => {
    onExport({
      status: statusFilter !== "all" ? statusFilter : undefined,
      search: searchTerm || undefined,
    });
  };

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = 
      order.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${order.billing.first_name} ${order.billing.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.billing.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Orders
          </CardTitle>
          <Button onClick={handleExport} variant="outline" data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 mb-6 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders, customers, or emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-orders"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {orderStatuses?.map((status) => (
                <SelectItem key={status.slug} value={status.slug}>
                  {status.name} ({status.total})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">
            Loading orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No orders found</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold w-10">Stock</TableHead>
                    <TableHead className="font-semibold">Order</TableHead>
                    <TableHead className="font-semibold">Customer</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Delivery Method</TableHead>
                    <TableHead className="font-semibold text-right">Tax</TableHead>
                    <TableHead className="font-semibold text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const status = fulfillmentStatus?.[order.id];
                    const canFulfill = status?.canFulfill ?? true;
                    const isProcessed = status?.isProcessed ?? false;
                    const missingMaterials = status?.missingMaterials ?? [];
                    
                    return (
                    <TableRow 
                      key={order.id} 
                      data-testid={`row-order-${order.id}`}
                      className="cursor-pointer hover-elevate"
                      onClick={() => handleOrderClick(order)}
                    >
                      <TableCell className="text-center" data-testid={`stock-status-${order.id}`}>
                        {isProcessed ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <CheckCircle className="h-4 w-4 text-blue-500 mx-auto" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Already processed</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : canFulfill ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Circle className="h-4 w-4 fill-green-500 text-green-500 mx-auto" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Stock available</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Circle className="h-4 w-4 fill-red-500 text-red-500 mx-auto" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-medium mb-1">Insufficient stock:</p>
                              <ul className="text-xs space-y-0.5">
                                {missingMaterials.slice(0, 5).map((m, i) => (
                                  <li key={i}>
                                    {m.materialName}: need {m.needed}, have {m.available}
                                  </li>
                                ))}
                                {missingMaterials.length > 5 && (
                                  <li className="text-muted-foreground">
                                    +{missingMaterials.length - 5} more...
                                  </li>
                                )}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-order-number-${order.id}`}>
                        #{order.number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {order.billing.first_name} {order.billing.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {order.billing.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(order.date_created), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-1">
                          <div className="text-muted-foreground">
                            {order.shipping_lines && order.shipping_lines.length > 0
                              ? order.shipping_lines[0].method_title
                              : "N/A"}
                          </div>
                          {getOrderMeta(order, 'delivery_shipping_partner') && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Truck className="h-3 w-3" />
                              <span>{getOrderMeta(order, 'delivery_shipping_partner')}</span>
                            </div>
                          )}
                          {getOrderMeta(order, 'delivery_tracking_number') && (() => {
                            const trackingNumber = getOrderMeta(order, 'delivery_tracking_number');
                            const shippingPartner = getOrderMeta(order, 'delivery_shipping_partner');
                            const isAnPost = shippingPartner?.toLowerCase().includes('an post');
                            
                            return isAnPost ? (
                              <a 
                                href={`https://www.anpost.com/Post-Parcels/Track/History?item=${trackingNumber}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`link-tracking-${order.id}`}
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span className="font-mono">{trackingNumber}</span>
                              </a>
                            ) : (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="font-mono">{trackingNumber}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        € {parseFloat(order.total_tax || "0").toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        € {parseFloat(order.total).toFixed(2)}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredOrders.length} of {orders.length} orders
            </div>
          </>
        )}
      </CardContent>

      <OrderDetailsDialog 
        order={selectedOrder}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </Card>
  );
}
