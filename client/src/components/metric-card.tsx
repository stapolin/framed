import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  testId?: string;
}

export function MetricCard({ title, value, icon: Icon, subtitle, trend, testId }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2 bg-primary/10 rounded-md">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          {trend && (
            <div className={`text-sm font-medium ${trend.isPositive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
            {title}
          </p>
          <p className="text-4xl font-bold" data-testid={testId}>
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
