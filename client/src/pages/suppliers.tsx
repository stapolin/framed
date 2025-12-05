import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Plus,
  Search,
  Loader2,
  Building2,
  Edit,
  Trash2,
  Eye,
  Mail,
  Phone,
  MapPin,
  User,
  FileText,
  ShoppingCart,
  Euro,
  ArrowUpDown
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { Supplier } from "@shared/schema";

interface SupplierStatistics {
  supplierId: number;
  poCount: number;
  totalSpent: string;
}

interface PurchaseOrderItem {
  id: number;
  purchaseOrderId: number;
  materialProductId: number;
  materialVariationId: number | null;
  materialName: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: string;
  vatRate: string;
  lineSubtotal: string;
  lineVat: string;
  lineTotal: string;
}

interface PurchaseOrderWithDetails {
  id: number;
  poNumber: string;
  supplierId: number;
  supplier?: Supplier;
  status: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
  orderDate: string | null;
  expectedDeliveryDate: string | null;
  receivedDate: string | null;
  subtotal: string;
  shippingCost: string;
  shippingVatRate: string;
  shippingVat: string;
  vatTotal: string;
  grandTotal: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseOrderItem[];
}

interface SupplierWithStats extends Supplier {
  poCount: number;
  totalSpent: string;
}

type SortField = "name" | "poCount" | "totalSpent";
type SortDirection = "asc" | "desc";

export default function Suppliers() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierWithStats | null>(null);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [formName, setFormName] = useState("");
  const [formContactName, setFormContactName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const { data: suppliers, isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: statistics, isLoading: statsLoading } = useQuery<SupplierStatistics[]>({
    queryKey: ["/api/suppliers/statistics"],
  });

  const { data: supplierPOs, isLoading: posLoading } = useQuery<PurchaseOrderWithDetails[]>({
    queryKey: ["/api/suppliers", selectedSupplier?.id, "purchase-orders"],
    queryFn: async () => {
      if (!selectedSupplier?.id) return [];
      const response = await fetch(`/api/suppliers/${selectedSupplier.id}/purchase-orders`);
      if (!response.ok) throw new Error("Failed to fetch supplier purchase orders");
      return response.json();
    },
    enabled: !!selectedSupplier?.id && showDetailsDialog,
  });

  const suppliersWithStats = useMemo(() => {
    if (!suppliers) return [];
    
    return suppliers.map(supplier => {
      const stats = statistics?.find(s => s.supplierId === supplier.id);
      return {
        ...supplier,
        poCount: stats?.poCount || 0,
        totalSpent: stats?.totalSpent || "0",
      };
    });
  }, [suppliers, statistics]);

  const filteredAndSortedSuppliers = useMemo(() => {
    let result = suppliersWithStats;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(term) ||
        s.email?.toLowerCase().includes(term) ||
        s.contactName?.toLowerCase().includes(term)
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "poCount") {
        comparison = a.poCount - b.poCount;
      } else if (sortField === "totalSpent") {
        comparison = parseFloat(a.totalSpent) - parseFloat(b.totalSpent);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [suppliersWithStats, searchTerm, sortField, sortDirection]);

  const createSupplierMutation = useMutation({
    mutationFn: async (data: Partial<Supplier>) => {
      return apiRequest("POST", "/api/suppliers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setShowAddDialog(false);
      resetForm();
      toast({
        title: "Supplier Created",
        description: "New supplier has been added successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create supplier",
      });
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Supplier> }) => {
      return apiRequest("PUT", `/api/suppliers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setShowEditDialog(false);
      setSelectedSupplier(null);
      resetForm();
      toast({
        title: "Supplier Updated",
        description: "Supplier has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update supplier",
      });
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/suppliers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers/statistics"] });
      setShowDeleteDialog(false);
      setSelectedSupplier(null);
      toast({
        title: "Supplier Deactivated",
        description: "Supplier has been deactivated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete supplier",
      });
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormContactName("");
    setFormEmail("");
    setFormPhone("");
    setFormAddress("");
    setFormNotes("");
  };

  const populateForm = (supplier: SupplierWithStats) => {
    setFormName(supplier.name);
    setFormContactName(supplier.contactName || "");
    setFormEmail(supplier.email || "");
    setFormPhone(supplier.phone || "");
    setFormAddress(supplier.address || "");
    setFormNotes(supplier.notes || "");
  };

  const handleAddSupplier = () => {
    if (!formName.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Supplier name is required",
      });
      return;
    }

    createSupplierMutation.mutate({
      name: formName,
      contactName: formContactName || null,
      email: formEmail || null,
      phone: formPhone || null,
      address: formAddress || null,
      notes: formNotes || null,
      isActive: true,
    });
  };

  const handleUpdateSupplier = () => {
    if (!selectedSupplier) return;
    if (!formName.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Supplier name is required",
      });
      return;
    }

    updateSupplierMutation.mutate({
      id: selectedSupplier.id,
      data: {
        name: formName,
        contactName: formContactName || null,
        email: formEmail || null,
        phone: formPhone || null,
        address: formAddress || null,
        notes: formNotes || null,
      },
    });
  };

  const openEditDialog = (supplier: SupplierWithStats) => {
    setSelectedSupplier(supplier);
    populateForm(supplier);
    setShowEditDialog(true);
  };

  const openDetailsDialog = (supplier: SupplierWithStats) => {
    setSelectedSupplier(supplier);
    setShowDetailsDialog(true);
  };

  const openDeleteDialog = (supplier: SupplierWithStats) => {
    setSelectedSupplier(supplier);
    setShowDeleteDialog(true);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return `€${num.toFixed(2)}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      ordered: "default",
      partially_received: "outline",
      received: "default",
      cancelled: "destructive",
    };
    const labels: Record<string, string> = {
      draft: "Draft",
      ordered: "Ordered",
      partially_received: "Partial",
      received: "Received",
      cancelled: "Cancelled",
    };
    return (
      <Badge variant={variants[status] || "secondary"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const totalSpentAllSuppliers = useMemo(() => {
    return suppliersWithStats.reduce((sum, s) => sum + parseFloat(s.totalSpent), 0);
  }, [suppliersWithStats]);

  const totalPOCount = useMemo(() => {
    return suppliersWithStats.reduce((sum, s) => sum + s.poCount, 0);
  }, [suppliersWithStats]);

  const isLoading = suppliersLoading || statsLoading;

  return (
    <main className="container py-6 px-6 max-w-7xl">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Suppliers</h1>
            <p className="text-muted-foreground">Manage your suppliers and view purchase history</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-supplier">
            <Plus className="h-4 w-4 mr-2" />
            Add Supplier
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-suppliers">
                {isLoading ? <Skeleton className="h-8 w-16" /> : suppliersWithStats.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Purchase Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-pos">
                {isLoading ? <Skeleton className="h-8 w-16" /> : totalPOCount}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-spent">
                {isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(totalSpentAllSuppliers)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Supplier List</CardTitle>
                <CardDescription>View and manage all your suppliers</CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search suppliers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-suppliers"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredAndSortedSuppliers.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No Suppliers Found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? "No suppliers match your search" : "Get started by adding your first supplier"}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Supplier
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 -ml-3 font-semibold"
                          onClick={() => toggleSort("name")}
                          data-testid="button-sort-name"
                        >
                          Supplier
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 -ml-3 font-semibold"
                          onClick={() => toggleSort("poCount")}
                          data-testid="button-sort-po-count"
                        >
                          Orders
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 -ml-3 font-semibold"
                          onClick={() => toggleSort("totalSpent")}
                          data-testid="button-sort-total-spent"
                        >
                          Total Spent
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedSuppliers.map((supplier) => (
                      <TableRow key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-md">
                              <Building2 className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium" data-testid={`text-supplier-name-${supplier.id}`}>
                                {supplier.name}
                              </div>
                              {supplier.contactName && (
                                <div className="text-sm text-muted-foreground">
                                  {supplier.contactName}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-sm">
                            {supplier.email && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {supplier.email}
                              </div>
                            )}
                            {supplier.phone && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {supplier.phone}
                              </div>
                            )}
                            {!supplier.email && !supplier.phone && (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" data-testid={`text-po-count-${supplier.id}`}>
                            {supplier.poCount} PO{supplier.poCount !== 1 ? "s" : ""}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium" data-testid={`text-total-spent-${supplier.id}`}>
                            {formatCurrency(supplier.totalSpent)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDetailsDialog(supplier)}
                              data-testid={`button-view-supplier-${supplier.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(supplier)}
                              data-testid={`button-edit-supplier-${supplier.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(supplier)}
                              data-testid={`button-delete-supplier-${supplier.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
            <DialogDescription>
              Enter the details of the new supplier
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Supplier Name *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Enter supplier name"
                data-testid="input-supplier-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactName">Contact Person</Label>
              <Input
                id="contactName"
                value={formContactName}
                onChange={(e) => setFormContactName(e.target.value)}
                placeholder="Enter contact name"
                data-testid="input-contact-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="email@example.com"
                  data-testid="input-supplier-email"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+353..."
                  data-testid="input-supplier-phone"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Enter supplier address"
                rows={2}
                data-testid="input-supplier-address"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
                data-testid="input-supplier-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddSupplier}
              disabled={createSupplierMutation.isPending}
              data-testid="button-save-supplier"
            >
              {createSupplierMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
            <DialogDescription>
              Update the supplier details
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Supplier Name *</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Enter supplier name"
                data-testid="input-edit-supplier-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-contactName">Contact Person</Label>
              <Input
                id="edit-contactName"
                value={formContactName}
                onChange={(e) => setFormContactName(e.target.value)}
                placeholder="Enter contact name"
                data-testid="input-edit-contact-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="email@example.com"
                  data-testid="input-edit-supplier-email"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+353..."
                  data-testid="input-edit-supplier-phone"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-address">Address</Label>
              <Textarea
                id="edit-address"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Enter supplier address"
                rows={2}
                data-testid="input-edit-supplier-address"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
                data-testid="input-edit-supplier-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); resetForm(); setSelectedSupplier(null); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateSupplier}
              disabled={updateSupplierMutation.isPending}
              data-testid="button-update-supplier"
            >
              {updateSupplierMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedSupplier?.name}
            </DialogTitle>
            <DialogDescription>
              Supplier details and purchase order history
            </DialogDescription>
          </DialogHeader>
          
          {selectedSupplier && (
            <div className="space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Contact Information</h4>
                  <div className="space-y-2 text-sm">
                    {selectedSupplier.contactName && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {selectedSupplier.contactName}
                      </div>
                    )}
                    {selectedSupplier.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${selectedSupplier.email}`} className="text-primary hover:underline">
                          {selectedSupplier.email}
                        </a>
                      </div>
                    )}
                    {selectedSupplier.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${selectedSupplier.phone}`} className="text-primary hover:underline">
                          {selectedSupplier.phone}
                        </a>
                      </div>
                    )}
                    {selectedSupplier.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span className="whitespace-pre-line">{selectedSupplier.address}</span>
                      </div>
                    )}
                    {!selectedSupplier.contactName && !selectedSupplier.email && !selectedSupplier.phone && !selectedSupplier.address && (
                      <p className="text-muted-foreground">No contact information provided</p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-medium">Statistics</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-md">
                      <div className="text-2xl font-bold" data-testid="text-detail-po-count">
                        {selectedSupplier.poCount}
                      </div>
                      <div className="text-sm text-muted-foreground">Purchase Orders</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-md">
                      <div className="text-2xl font-bold" data-testid="text-detail-total-spent">
                        {formatCurrency(selectedSupplier.totalSpent)}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Spent</div>
                    </div>
                  </div>
                  {selectedSupplier.notes && (
                    <div>
                      <h4 className="font-medium mb-2">Notes</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {selectedSupplier.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Purchase Order History
                </h4>
                
                {posLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !supplierPOs || supplierPOs.length === 0 ? (
                  <div className="text-center py-8 bg-muted/30 rounded-lg">
                    <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No purchase orders yet</p>
                    <Link href="/purchase-orders">
                      <Button variant="ghost" className="mt-2 text-primary">
                        Create Purchase Order
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>PO Number</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supplierPOs.map((po) => (
                          <TableRow key={po.id} data-testid={`row-po-${po.id}`}>
                            <TableCell className="font-medium">
                              <Link href="/purchase-orders">
                                <span className="text-primary hover:underline cursor-pointer">
                                  {po.poNumber}
                                </span>
                              </Link>
                            </TableCell>
                            <TableCell>{formatDate(po.orderDate)}</TableCell>
                            <TableCell>{getStatusBadge(po.status)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(po.grandTotal)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
            <Button onClick={() => { setShowDetailsDialog(false); openEditDialog(selectedSupplier!); }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate "{selectedSupplier?.name}"? 
              This supplier will no longer appear in lists, but their purchase order history will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedSupplier && deleteSupplierMutation.mutate(selectedSupplier.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteSupplierMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
