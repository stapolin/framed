import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "@/components/metric-card";
import { OrderTrendsChart } from "@/components/order-trends-chart";
import { StatusDistributionChart } from "@/components/status-distribution-chart";
import { OrdersTable } from "@/components/orders-table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCredentials } from "@/contexts/credentials-context";
import { DollarSign, ShoppingCart, TrendingUp, Clock, AlertCircle, Settings, Receipt } from "lucide-react";
import { useLocation } from "wouter";
import type { Order, DashboardMetrics, OrderTrend, DateRangePreset } from "@shared/schema";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRangePreset>("last30days");
  const { hasCredentials } = useCredentials();

  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/metrics", { dateRange }],
    enabled: hasCredentials,
  });

  const { data: trends, isLoading: trendsLoading } = useQuery<OrderTrend[]>({
    queryKey: ["/api/trends", { dateRange }],
    enabled: hasCredentials,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders", { dateRange }],
    enabled: hasCredentials,
  });

  const calculateTotalTaxes = () => {
    if (!orders) return 0;
    return orders.reduce((sum, order) => sum + parseFloat(order.total_tax || "0"), 0);
  };

  const handleExport = async (filters: { status?: string; search?: string }) => {
    if (!orders || orders.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no orders to export for the selected period.",
        variant: "destructive",
      });
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append("dateRange", dateRange);
      if (filters.status) params.append("status", filters.status);
      if (filters.search) params.append("search", filters.search);

      const response = await fetch(`/api/export/csv?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to export CSV");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `woocommerce-orders-${dateRange}-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: `Exported orders to CSV.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export orders. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!hasCredentials) {
    return (
      <div className="container max-w-7xl mx-auto py-12 px-6">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="p-4 bg-muted/50 rounded-full mb-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">WooCommerce Not Connected</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            To view your order reports and analytics, please configure your WooCommerce API credentials first.
          </p>
          <Button onClick={() => setLocation("/settings")} data-testid="button-configure-settings">
            <Settings className="h-4 w-4 mr-2" />
            Configure Settings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto py-8 px-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1" data-testid="text-dashboard-title">
            Order Analytics
          </h1>
          <p className="text-muted-foreground">
            Track your store's performance and order metrics
          </p>
        </div>
        <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRangePreset)}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-date-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="last7days">Last 7 Days</SelectItem>
            <SelectItem value="last30days">Last 30 Days</SelectItem>
            <SelectItem value="last90days">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-5 mb-8">
        <MetricCard
          title="Total Revenue"
          value={metricsLoading ? "..." : `€${metrics?.totalRevenue.toLocaleString() || 0}`}
          icon={DollarSign}
          testId="text-metric-revenue"
        />
        <MetricCard
          title="Total Orders"
          value={metricsLoading ? "..." : metrics?.totalOrders || 0}
          icon={ShoppingCart}
          testId="text-metric-orders"
        />
        <MetricCard
          title="Avg Order Value"
          value={metricsLoading ? "..." : `€${metrics?.averageOrderValue.toFixed(2) || 0}`}
          icon={TrendingUp}
          testId="text-metric-aov"
        />
        <MetricCard
          title="Total Taxes"
          value={ordersLoading ? "..." : `€${calculateTotalTaxes().toLocaleString()}`}
          icon={Receipt}
          testId="text-metric-taxes"
        />
        <MetricCard
          title="Pending Orders"
          value={metricsLoading ? "..." : (metrics?.ordersByStatus.pending || 0) + (metrics?.ordersByStatus["order-received"] || 0)}
          icon={Clock}
          testId="text-metric-pending"
        />
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-2 mb-8">
        <OrderTrendsChart 
          data={trends || []} 
          isLoading={trendsLoading}
        />
        <StatusDistributionChart 
          data={metrics?.ordersByStatus || {}} 
          isLoading={metricsLoading}
        />
      </div>

      <OrdersTable 
        orders={orders || []} 
        isLoading={ordersLoading}
        onExport={handleExport}
      />
    </div>
  );
}
