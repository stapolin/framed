import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function MetricCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-10 w-32" />
      </CardContent>
    </Card>
  );
}

export function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-96 w-full" />
      </CardContent>
    </Card>
  );
}
