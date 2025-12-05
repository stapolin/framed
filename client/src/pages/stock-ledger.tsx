import { useQuery } from "@tanstack/react-query";
import { useCredentials } from "@/contexts/credentials-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, History, Package, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import type { StockLedgerEntry, LocalRawMaterialWithVariations } from "@shared/schema";
import { Link } from "wouter";

export default function StockLedger() {
  const { hasCredentials } = useCredentials();
  const [materialFilter, setMaterialFilter] = useState<string>("all");

  const { data: rawMaterials, isLoading: materialsLoading } = useQuery<LocalRawMaterialWithVariations[]>({
    queryKey: ["/api/local-materials"],
  });

  const { data: ledgerEntries, isLoading: ledgerLoading } = useQuery<StockLedgerEntry[]>({
    queryKey: ["/api/stock-ledger", materialFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (materialFilter !== "all") {
        params.append("materialProductId", materialFilter);
      }
      params.append("limit", "200");
      const response = await fetch(`/api/stock-ledger?${params}`);
      if (!response.ok) throw new Error("Failed to fetch stock ledger");
      return response.json();
    },
  });

  const getMaterialName = (materialId: number) => {
    return rawMaterials?.find((m) => m.id === materialId)?.name || `Material #${materialId}`;
  };

  const getReasonBadge = (reason: string) => {
    switch (reason) {
      case "order":
        return <Badge variant="destructive">Order</Badge>;
      case "adjustment":
        return <Badge variant="outline">Adjustment</Badge>;
      case "restock":
        return <Badge className="bg-green-600 hover:bg-green-700">Restock</Badge>;
      default:
        return <Badge variant="secondary">{reason}</Badge>;
    }
  };

  if (!hasCredentials) {
    return (
      <main className="container mx-auto px-6 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Link href="/inventory">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-ledger-title">
                Stock Ledger
              </h1>
              <p className="text-muted-foreground">
                Track all inventory changes and order deductions
              </p>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Configure WooCommerce</CardTitle>
              <CardDescription>
                Please configure your WooCommerce credentials in Settings to view the stock ledger.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/settings">
                <Button data-testid="button-go-to-settings">Go to Settings</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-6 py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/inventory">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-ledger-title">
                Stock Ledger
              </h1>
              <p className="text-muted-foreground">
                Track all inventory changes and order deductions
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Transaction History</CardTitle>
              </div>
              <Select value={materialFilter} onValueChange={setMaterialFilter}>
                <SelectTrigger className="w-full sm:w-[250px]" data-testid="select-material-filter">
                  <SelectValue placeholder="Filter by material" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Materials</SelectItem>
                  {rawMaterials?.map((material) => (
                    <SelectItem key={material.id} value={material.id.toString()}>
                      {material.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {ledgerLoading || materialsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : ledgerEntries && ledgerEntries.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead className="text-right">Change</TableHead>
                      <TableHead className="text-right">Previous</TableHead>
                      <TableHead className="text-right">New</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerEntries.map((entry) => (
                      <TableRow key={entry.id} data-testid={`row-ledger-${entry.id}`}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(entry.createdAt), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {getMaterialName(entry.materialProductId)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getReasonBadge(entry.reason)}</TableCell>
                        <TableCell>
                          {entry.orderNumber ? (
                            <span className="font-mono text-sm">#{entry.orderNumber}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {entry.quantityChange < 0 ? (
                              <TrendingDown className="h-4 w-4 text-destructive" />
                            ) : (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            )}
                            <span
                              className={
                                entry.quantityChange < 0
                                  ? "text-destructive font-medium"
                                  : "text-green-600 font-medium"
                              }
                            >
                              {entry.quantityChange > 0 ? "+" : ""}
                              {entry.quantityChange}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {entry.previousStock}
                        </TableCell>
                        <TableCell className="text-right font-medium">{entry.newStock}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {entry.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <History className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Transactions Yet</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Stock changes will appear here when orders are processed or manual adjustments are
                  made.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
