import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { OrderTrend } from "@shared/schema";
import { TrendingUp } from "lucide-react";

interface OrderTrendsChartProps {
  data: OrderTrend[];
  isLoading?: boolean;
}

export function OrderTrendsChart({ data, isLoading }: OrderTrendsChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Order Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center">
            <div className="text-muted-foreground">Loading chart data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Order Trends Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96" data-testid="chart-order-trends">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="orders"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                name="Orders"
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                name="Revenue"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
