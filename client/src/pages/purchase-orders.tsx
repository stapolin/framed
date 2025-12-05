import { useQuery, useMutation } from "@tanstack/react-query";
import { useCredentials } from "@/contexts/credentials-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
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
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus,
  Search,
  Loader2,
  Package,
  Trash2,
  Eye,
  PackageCheck,
  Building2,
  Calendar,
  FileText,
  Edit,
  X,
  Check,
  FileDown,
  Printer
} from "lucide-react";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { Supplier, LocalRawMaterialWithVariations, LocalRawMaterialVariation } from "@shared/schema";

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

interface NewPOItem {
  materialProductId: number;
  materialVariationId: number | null;
  materialName: string;
  quantityOrdered: number;
  unitPrice: string;
  vatRate: string;
}

export default function PurchaseOrders() {
  const { hasCredentials } = useCredentials();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderWithDetails | null>(null);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<number, number>>({});
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  // Form state for creating/editing PO
  const [formSupplierId, setFormSupplierId] = useState<string>("");
  const [formOrderDate, setFormOrderDate] = useState<string>("");
  const [formExpectedDate, setFormExpectedDate] = useState<string>("");
  const [formShippingCost, setFormShippingCost] = useState<string>("0");
  const [formShippingVatRate, setFormShippingVatRate] = useState<string>("0");
  const [formNotes, setFormNotes] = useState<string>("");
  const [formItems, setFormItems] = useState<NewPOItem[]>([]);

  // Add item form state
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [selectedVariationId, setSelectedVariationId] = useState<string>("");
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemUnitPrice, setItemUnitPrice] = useState<string>("0.00");
  const [itemVatRate, setItemVatRate] = useState<string>("23");

  // New supplier form state
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierEmail, setNewSupplierEmail] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierAddress, setNewSupplierAddress] = useState("");
  const [newSupplierContact, setNewSupplierContact] = useState("");

  // Queries
  const { data: purchaseOrders, isLoading: ordersLoading } = useQuery<PurchaseOrderWithDetails[]>({
    queryKey: ["/api/purchase-orders"],
  });

  const { data: suppliers, isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: rawMaterials, isLoading: materialsLoading } = useQuery<LocalRawMaterialWithVariations[]>({
    queryKey: ["/api/local-materials"],
  });

  const { data: nextPONumber } = useQuery<{ poNumber: string }>({
    queryKey: ["/api/purchase-orders/next-number"],
    enabled: showCreateDialog,
  });

  // Get variations for selected material
  const selectedMaterial = rawMaterials?.find(m => m.id === parseInt(selectedMaterialId));
  const materialVariations = selectedMaterial?.type === "variable" ? selectedMaterial.variations : [];

  // Mutations
  const createSupplierMutation = useMutation({
    mutationFn: async (data: Partial<Supplier>) => {
      return apiRequest("POST", "/api/suppliers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setShowSupplierDialog(false);
      resetSupplierForm();
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

  const createPOMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/purchase-orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders/next-number"] });
      setShowCreateDialog(false);
      resetPOForm();
      toast({
        title: "Purchase Order Created",
        description: "New purchase order has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create purchase order",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PATCH", `/api/purchase-orders/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({
        title: "Status Updated",
        description: "Purchase order status has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update status",
      });
    },
  });

  const deletePOMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/purchase-orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setShowDeleteDialog(false);
      setSelectedPO(null);
      toast({
        title: "Purchase Order Deleted",
        description: "The purchase order has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete purchase order",
      });
    },
  });

  const receiveItemsMutation = useMutation({
    mutationFn: async ({ id, items }: { id: number; items: { itemId: number; quantityReceived: number }[] }) => {
      return apiRequest("POST", `/api/purchase-orders/${id}/receive`, { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/local-materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-ledger"] });
      setShowReceiveDialog(false);
      setSelectedPO(null);
      setReceiveQuantities({});
      setCheckedItems(new Set());
      toast({
        title: "Items Received",
        description: "Stock has been updated with received items.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to receive items",
      });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async ({ poId, item }: { poId: number; item: NewPOItem }) => {
      return apiRequest("POST", `/api/purchase-orders/${poId}/items`, item);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      if (data) {
        setSelectedPO(data);
      }
      toast({
        title: "Item Added",
        description: "Item has been added to the purchase order.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add item",
      });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async ({ poId, itemId }: { poId: number; itemId: number }) => {
      return apiRequest("DELETE", `/api/purchase-orders/${poId}/items/${itemId}`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setSelectedPO(data);
      toast({
        title: "Item Removed",
        description: "Item has been removed from the purchase order.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to remove item",
      });
    },
  });

  const updateShippingMutation = useMutation({
    mutationFn: async ({ poId, shippingCost, shippingVatRate }: { poId: number; shippingCost: string; shippingVatRate: string }) => {
      return apiRequest("PATCH", `/api/purchase-orders/${poId}/shipping`, { shippingCost, shippingVatRate });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setSelectedPO(data);
      toast({
        title: "Shipping Updated",
        description: "Shipping details have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update shipping",
      });
    },
  });

  const resetSupplierForm = () => {
    setNewSupplierName("");
    setNewSupplierEmail("");
    setNewSupplierPhone("");
    setNewSupplierAddress("");
    setNewSupplierContact("");
  };

  const resetPOForm = () => {
    setFormSupplierId("");
    setFormOrderDate("");
    setFormExpectedDate("");
    setFormShippingCost("0");
    setFormShippingVatRate("0");
    setFormNotes("");
    setFormItems([]);
    setSelectedMaterialId("");
    setSelectedVariationId("");
    setItemQuantity(1);
    setItemUnitPrice("0.00");
    setItemVatRate("23");
  };

  const addItemToForm = () => {
    if (!selectedMaterialId || itemQuantity <= 0) return;

    const material = rawMaterials?.find(m => m.id === parseInt(selectedMaterialId));
    if (!material) return;

    let materialName = material.name;
    let variationId: number | null = null;

    if (selectedVariationId && material.type === "variable") {
      const variation = material.variations?.find(v => v.id === parseInt(selectedVariationId));
      if (variation) {
        materialName = `${material.name} - ${variation.name}`;
        variationId = variation.id;
      }
    }

    setFormItems([...formItems, {
      materialProductId: parseInt(selectedMaterialId),
      materialVariationId: variationId,
      materialName,
      quantityOrdered: itemQuantity,
      unitPrice: itemUnitPrice,
      vatRate: itemVatRate,
    }]);

    setSelectedMaterialId("");
    setSelectedVariationId("");
    setItemQuantity(1);
    setItemUnitPrice("0.00");
  };

  const removeItemFromForm = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const handleCreatePO = () => {
    if (!formSupplierId || formItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select a supplier and add at least one item.",
      });
      return;
    }

    createPOMutation.mutate({
      poNumber: nextPONumber?.poNumber || `PO-${Date.now()}`,
      supplierId: parseInt(formSupplierId),
      status: "draft",
      orderDate: formOrderDate || null,
      expectedDeliveryDate: formExpectedDate || null,
      shippingCost: formShippingCost,
      notes: formNotes || null,
      items: formItems,
    });
  };

  const handleReceiveItems = () => {
    if (!selectedPO) return;

    // Build items from checked checkboxes - receive remaining quantity for each checked item
    const items = selectedPO.items
      .filter(item => checkedItems.has(item.id))
      .filter(item => item.quantityReceived < item.quantityOrdered)
      .map(item => ({
        itemId: item.id,
        quantityReceived: item.quantityOrdered - item.quantityReceived,
      }));

    if (items.length === 0) {
      toast({
        variant: "destructive",
        title: "No Items Selected",
        description: "Please tick the items you have received.",
      });
      return;
    }

    receiveItemsMutation.mutate({ id: selectedPO.id, items });
  };

  const handleAddItemToDraftPO = () => {
    if (!selectedPO || !selectedMaterialId) return;

    const material = rawMaterials?.find(m => m.id === parseInt(selectedMaterialId));
    if (!material) return;

    let materialName = material.name;
    let variationId: number | null = null;

    if (selectedVariationId && material.type === "variable") {
      const variation = material.variations?.find(v => v.id === parseInt(selectedVariationId));
      if (variation) {
        variationId = variation.id;
        materialName = `${material.name} - ${variation.name}`;
      }
    }

    addItemMutation.mutate({
      poId: selectedPO.id,
      item: {
        materialProductId: material.id,
        materialVariationId: variationId,
        materialName,
        quantityOrdered: itemQuantity,
        unitPrice: itemUnitPrice,
        vatRate: itemVatRate,
      },
    });

    // Reset item form fields
    setSelectedMaterialId("");
    setSelectedVariationId("");
    setItemQuantity(1);
    setItemUnitPrice("0.00");
  };

  const handleDownloadPDF = (poId: number, poNumber: string) => {
    window.open(`/api/purchase-orders/${poId}/pdf`, '_blank');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      case "ordered":
        return <Badge className="bg-blue-600 hover:bg-blue-700">Ordered</Badge>;
      case "partially_received":
        return <Badge className="bg-amber-500 hover:bg-amber-600">Partially Received</Badge>;
      case "received":
        return <Badge className="bg-green-600 hover:bg-green-700">Received</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(num);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-IE", { 
      day: "2-digit", 
      month: "short", 
      year: "numeric" 
    });
  };

  // Calculate form totals
  const formTotals = useMemo(() => {
    let subtotal = 0;
    let itemsVat = 0;
    formItems.forEach(item => {
      const lineSubtotal = item.quantityOrdered * parseFloat(item.unitPrice);
      const lineVat = lineSubtotal * (parseFloat(item.vatRate) / 100);
      subtotal += lineSubtotal;
      itemsVat += lineVat;
    });
    const shipping = parseFloat(formShippingCost) || 0;
    const shippingVat = shipping * (parseFloat(formShippingVatRate) / 100);
    const vatTotal = itemsVat + shippingVat;
    const grandTotal = subtotal + vatTotal + shipping;
    return { subtotal, itemsVat, shipping, shippingVat, vatTotal, grandTotal };
  }, [formItems, formShippingCost, formShippingVatRate]);

  // Filter purchase orders
  const filteredOrders = useMemo(() => {
    return purchaseOrders?.filter(po => {
      const matchesSearch = searchTerm === "" || 
        po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || po.status === statusFilter;
      const matchesSupplier = supplierFilter === "all" || po.supplierId === parseInt(supplierFilter);
      return matchesSearch && matchesStatus && matchesSupplier;
    }) || [];
  }, [purchaseOrders, searchTerm, statusFilter, supplierFilter]);

  if (!hasCredentials) {
    return (
      <main className="container mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Configure WooCommerce</CardTitle>
            <CardDescription>
              Please configure your WooCommerce credentials in Settings to manage purchase orders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/settings">
              <Button data-testid="button-go-to-settings">Go to Settings</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-6 py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-purchase-orders-title">Purchase Orders</h1>
            <p className="text-muted-foreground">
              Manage supplier orders and receive stock
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowSupplierDialog(true)}
              data-testid="button-add-supplier"
            >
              <Building2 className="mr-2 h-4 w-4" />
              Add Supplier
            </Button>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              data-testid="button-create-po"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Purchase Order
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by PO number or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-po"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-status-filter">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="ordered">Ordered</SelectItem>
              <SelectItem value="partially_received">Partially Received</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-supplier-filter">
              <SelectValue placeholder="All Suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers?.map(supplier => (
                <SelectItem key={supplier.id} value={supplier.id.toString()}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <FileText className="h-8 w-8" />
                        <p>No purchase orders found</p>
                        <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
                          Create your first purchase order
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map(po => (
                    <TableRow key={po.id} data-testid={`row-po-${po.id}`}>
                      <TableCell className="font-medium">{po.poNumber}</TableCell>
                      <TableCell>{po.supplier?.name || "-"}</TableCell>
                      <TableCell>{getStatusBadge(po.status)}</TableCell>
                      <TableCell>{formatDate(po.orderDate)}</TableCell>
                      <TableCell>{po.items.length}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(po.grandTotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedPO(po);
                              setShowDetailsDialog(true);
                            }}
                            data-testid={`button-view-po-${po.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(po.status === "ordered" || po.status === "partially_received") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedPO(po);
                                setReceiveQuantities({});
                                setShowReceiveDialog(true);
                              }}
                              data-testid={`button-receive-po-${po.id}`}
                            >
                              <PackageCheck className="h-4 w-4" />
                            </Button>
                          )}
                          {(po.status === "draft" || po.status === "cancelled") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedPO(po);
                                setShowDeleteDialog(true);
                              }}
                              data-testid={`button-delete-po-${po.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create Supplier Dialog */}
      <Dialog open={showSupplierDialog} onOpenChange={setShowSupplierDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Supplier</DialogTitle>
            <DialogDescription>
              Add a new supplier to your list
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="supplier-name">Supplier Name *</Label>
              <Input
                id="supplier-name"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Enter supplier name"
                data-testid="input-supplier-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-contact">Contact Person</Label>
              <Input
                id="supplier-contact"
                value={newSupplierContact}
                onChange={(e) => setNewSupplierContact(e.target.value)}
                placeholder="Contact name"
                data-testid="input-supplier-contact"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-email">Email</Label>
              <Input
                id="supplier-email"
                type="email"
                value={newSupplierEmail}
                onChange={(e) => setNewSupplierEmail(e.target.value)}
                placeholder="email@example.com"
                data-testid="input-supplier-email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-phone">Phone</Label>
              <Input
                id="supplier-phone"
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                placeholder="+353 1 234 5678"
                data-testid="input-supplier-phone"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-address">Address</Label>
              <Textarea
                id="supplier-address"
                value={newSupplierAddress}
                onChange={(e) => setNewSupplierAddress(e.target.value)}
                placeholder="Full address"
                data-testid="input-supplier-address"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSupplierDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createSupplierMutation.mutate({
                name: newSupplierName,
                contactName: newSupplierContact || null,
                email: newSupplierEmail || null,
                phone: newSupplierPhone || null,
                address: newSupplierAddress || null,
              })}
              disabled={!newSupplierName || createSupplierMutation.isPending}
              data-testid="button-save-supplier"
            >
              {createSupplierMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Purchase Order Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>
              {nextPONumber ? `PO Number: ${nextPONumber.poNumber}` : "Create a new purchase order for stock replenishment"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Supplier and Dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Supplier *</Label>
                <Select value={formSupplierId} onValueChange={setFormSupplierId}>
                  <SelectTrigger data-testid="select-po-supplier">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers?.map(supplier => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Order Date</Label>
                <Input
                  type="date"
                  value={formOrderDate}
                  onChange={(e) => setFormOrderDate(e.target.value)}
                  data-testid="input-po-order-date"
                />
              </div>
              <div className="grid gap-2">
                <Label>Expected Delivery</Label>
                <Input
                  type="date"
                  value={formExpectedDate}
                  onChange={(e) => setFormExpectedDate(e.target.value)}
                  data-testid="input-po-expected-date"
                />
              </div>
            </div>

            <Separator />

            {/* Add Items Section */}
            <div className="space-y-4">
              <h4 className="font-medium">Add Items</h4>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                <div className="md:col-span-2">
                  <Label className="text-xs">Material</Label>
                  <Select value={selectedMaterialId} onValueChange={(val) => {
                    setSelectedMaterialId(val);
                    setSelectedVariationId("");
                  }}>
                    <SelectTrigger data-testid="select-item-material">
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent>
                      {rawMaterials?.map(material => (
                        <SelectItem key={material.id} value={material.id.toString()}>
                          {material.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {materialVariations && materialVariations.length > 0 && (
                  <div>
                    <Label className="text-xs">Variation</Label>
                    <Select value={selectedVariationId} onValueChange={setSelectedVariationId}>
                      <SelectTrigger data-testid="select-item-variation">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {materialVariations.map(variation => (
                          <SelectItem key={variation.id} value={variation.id.toString()}>
                            {variation.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min="1"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                    data-testid="input-item-qty"
                  />
                </div>
                <div>
                  <Label className="text-xs">Unit Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemUnitPrice}
                    onChange={(e) => setItemUnitPrice(e.target.value)}
                    data-testid="input-item-price"
                  />
                </div>
                <div>
                  <Label className="text-xs">VAT %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={itemVatRate}
                    onChange={(e) => setItemVatRate(e.target.value)}
                    data-testid="input-item-vat"
                  />
                </div>
                <Button 
                  onClick={addItemToForm}
                  disabled={!selectedMaterialId}
                  size="sm"
                  data-testid="button-add-item"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Items List */}
              {formItems.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">VAT %</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formItems.map((item, index) => {
                      const lineSubtotal = item.quantityOrdered * parseFloat(item.unitPrice);
                      const lineVat = lineSubtotal * (parseFloat(item.vatRate) / 100);
                      const lineTotal = lineSubtotal + lineVat;
                      return (
                        <TableRow key={index}>
                          <TableCell>{item.materialName}</TableCell>
                          <TableCell className="text-right">{item.quantityOrdered}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell className="text-right">{item.vatRate}%</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(lineTotal)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeItemFromForm(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            <Separator />

            {/* Shipping and Totals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Shipping Cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formShippingCost}
                      onChange={(e) => setFormShippingCost(e.target.value)}
                      data-testid="input-po-shipping"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Shipping VAT %</Label>
                    <Select value={formShippingVatRate} onValueChange={setFormShippingVatRate}>
                      <SelectTrigger data-testid="select-shipping-vat">
                        <SelectValue placeholder="VAT %" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0% (No VAT)</SelectItem>
                        <SelectItem value="13.5">13.5%</SelectItem>
                        <SelectItem value="23">23%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Optional notes..."
                    data-testid="input-po-notes"
                  />
                </div>
              </div>
              <div className="space-y-2 text-right">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>{formatCurrency(formTotals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items VAT:</span>
                  <span>{formatCurrency(formTotals.itemsVat)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping:</span>
                  <span>{formatCurrency(formTotals.shipping)}</span>
                </div>
                {formTotals.shippingVat > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping VAT:</span>
                    <span>{formatCurrency(formTotals.shippingVat)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Grand Total:</span>
                  <span>{formatCurrency(formTotals.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              resetPOForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreatePO}
              disabled={!formSupplierId || formItems.length === 0 || createPOMutation.isPending}
              data-testid="button-submit-po"
            >
              {createPOMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Purchase Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>{selectedPO?.poNumber}</span>
              {selectedPO && getStatusBadge(selectedPO.status)}
            </DialogTitle>
            <DialogDescription>
              {selectedPO?.supplier?.name || "Unknown supplier"}
            </DialogDescription>
          </DialogHeader>
          {selectedPO && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Order Date</span>
                  <p className="font-medium">{formatDate(selectedPO.orderDate)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Expected Delivery</span>
                  <p className="font-medium">{formatDate(selectedPO.expectedDeliveryDate)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Received Date</span>
                  <p className="font-medium">{formatDate(selectedPO.receivedDate)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created</span>
                  <p className="font-medium">{formatDate(selectedPO.createdAt)}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPO.items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>{item.materialName}</TableCell>
                      <TableCell className="text-right">{item.quantityOrdered}</TableCell>
                      <TableCell className="text-right">
                        {item.quantityReceived >= item.quantityOrdered ? (
                          <span className="text-green-600">{item.quantityReceived}</span>
                        ) : item.quantityReceived > 0 ? (
                          <span className="text-amber-600">{item.quantityReceived}</span>
                        ) : (
                          item.quantityReceived
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.lineTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end">
                <div className="space-y-1 text-right w-56">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatCurrency(selectedPO.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Items VAT:</span>
                    <span>{formatCurrency(parseFloat(selectedPO.vatTotal) - parseFloat(selectedPO.shippingVat || "0"))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping:</span>
                    <span>{formatCurrency(selectedPO.shippingCost)}</span>
                  </div>
                  {parseFloat(selectedPO.shippingVat || "0") > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping VAT ({selectedPO.shippingVatRate}%):</span>
                      <span>{formatCurrency(selectedPO.shippingVat)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total:</span>
                    <span>{formatCurrency(selectedPO.grandTotal)}</span>
                  </div>
                </div>
              </div>

              {selectedPO.notes && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{selectedPO.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-between">
                <Button
                  variant="outline"
                  onClick={() => handleDownloadPDF(selectedPO.id, selectedPO.poNumber)}
                  data-testid="button-download-pdf"
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
                <div className="flex gap-2">
                  {selectedPO.status === "draft" && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowDetailsDialog(false);
                          setShowEditDialog(true);
                        }}
                        data-testid="button-edit-po"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Items
                      </Button>
                      <Button
                        onClick={() => {
                          updateStatusMutation.mutate({ id: selectedPO.id, status: "ordered" });
                          setShowDetailsDialog(false);
                        }}
                        data-testid="button-mark-ordered"
                      >
                        Mark as Ordered
                      </Button>
                    </>
                  )}
                  {(selectedPO.status === "ordered" || selectedPO.status === "partially_received") && (
                    <Button
                      onClick={() => {
                        setShowDetailsDialog(false);
                        setCheckedItems(new Set());
                        setShowReceiveDialog(true);
                      }}
                      data-testid="button-receive-items"
                    >
                      <PackageCheck className="mr-2 h-4 w-4" />
                      Receive Items
                    </Button>
                  )}
                  {(selectedPO.status === "draft" || selectedPO.status === "ordered" || selectedPO.status === "partially_received") && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        updateStatusMutation.mutate({ id: selectedPO.id, status: "cancelled" });
                        setShowDetailsDialog(false);
                      }}
                      data-testid="button-cancel-po"
                    >
                      Cancel Order
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Receive Items Dialog */}
      <Dialog open={showReceiveDialog} onOpenChange={(open) => {
        setShowReceiveDialog(open);
        if (!open) {
          setCheckedItems(new Set());
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Receive Items - {selectedPO?.poNumber}</DialogTitle>
            <DialogDescription>
              Tick the items that have arrived in this delivery
            </DialogDescription>
          </DialogHeader>
          {selectedPO && (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPO.items.map(item => {
                    const remaining = item.quantityOrdered - item.quantityReceived;
                    const isComplete = remaining === 0;
                    return (
                      <TableRow key={item.id} className={isComplete ? "opacity-50" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={isComplete || checkedItems.has(item.id)}
                            disabled={isComplete}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(checkedItems);
                              if (checked) {
                                newSet.add(item.id);
                              } else {
                                newSet.delete(item.id);
                              }
                              setCheckedItems(newSet);
                            }}
                            data-testid={`checkbox-receive-${item.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          {item.materialName}
                          {isComplete && <Badge variant="outline" className="ml-2 text-xs">Complete</Badge>}
                        </TableCell>
                        <TableCell className="text-right">{item.quantityOrdered}</TableCell>
                        <TableCell className="text-right">
                          {isComplete ? (
                            <Check className="h-4 w-4 text-green-600 ml-auto" />
                          ) : (
                            <span className="text-amber-600 font-medium">{remaining}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {checkedItems.size > 0 && (
                <p className="text-sm text-muted-foreground">
                  {checkedItems.size} item{checkedItems.size > 1 ? "s" : ""} selected for receiving
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowReceiveDialog(false);
              setCheckedItems(new Set());
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleReceiveItems}
              disabled={receiveItemsMutation.isPending || checkedItems.size === 0}
              data-testid="button-confirm-receive"
            >
              {receiveItemsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Receive Selected Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedPO?.poNumber}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedPO && deletePOMutation.mutate(selectedPO.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deletePOMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Draft PO Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open);
        if (!open) {
          setSelectedMaterialId("");
          setSelectedVariationId("");
          setItemQuantity(1);
          setItemUnitPrice("0.00");
          setItemVatRate("23");
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Purchase Order - {selectedPO?.poNumber}</DialogTitle>
            <DialogDescription>
              Add or remove items and update shipping details
            </DialogDescription>
          </DialogHeader>
          {selectedPO && selectedPO.status === "draft" && (
            <div className="space-y-6">
              {/* Current Items */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Current Items</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPO.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                          No items yet. Add items below.
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedPO.items.map(item => (
                        <TableRow key={item.id}>
                          <TableCell>{item.materialName}</TableCell>
                          <TableCell className="text-right">{item.quantityOrdered}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.lineTotal)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItemMutation.mutate({ poId: selectedPO.id, itemId: item.id })}
                              disabled={removeItemMutation.isPending}
                              data-testid={`button-remove-item-${item.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <Separator />

              {/* Add New Item */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Add New Item</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <Label>Material</Label>
                    <Select value={selectedMaterialId} onValueChange={(value) => {
                      setSelectedMaterialId(value);
                      setSelectedVariationId("");
                    }}>
                      <SelectTrigger data-testid="select-edit-material">
                        <SelectValue placeholder="Select material..." />
                      </SelectTrigger>
                      <SelectContent>
                        {rawMaterials?.map(material => (
                          <SelectItem key={material.id} value={material.id.toString()}>
                            {material.name} ({material.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedMaterial?.type === "variable" && (materialVariations?.length || 0) > 0 && (
                    <div className="col-span-2">
                      <Label>Variation</Label>
                      <Select value={selectedVariationId} onValueChange={setSelectedVariationId}>
                        <SelectTrigger data-testid="select-edit-variation">
                          <SelectValue placeholder="Select variation..." />
                        </SelectTrigger>
                        <SelectContent>
                          {materialVariations?.map(variation => (
                            <SelectItem key={variation.id} value={variation.id.toString()}>
                              {variation.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                      data-testid="input-edit-quantity"
                    />
                  </div>
                  <div>
                    <Label>Unit Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemUnitPrice}
                      onChange={(e) => setItemUnitPrice(e.target.value)}
                      data-testid="input-edit-price"
                    />
                  </div>
                  <div>
                    <Label>VAT %</Label>
                    <Select value={itemVatRate} onValueChange={setItemVatRate}>
                      <SelectTrigger data-testid="select-edit-item-vat">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="13.5">13.5%</SelectItem>
                        <SelectItem value="23">23%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleAddItemToDraftPO}
                      disabled={!selectedMaterialId || addItemMutation.isPending}
                      data-testid="button-add-edit-item"
                    >
                      {addItemMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Shipping Details */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Shipping</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Shipping Cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={selectedPO.shippingCost}
                      onBlur={(e) => {
                        const newCost = e.target.value;
                        if (newCost !== selectedPO.shippingCost) {
                          updateShippingMutation.mutate({
                            poId: selectedPO.id,
                            shippingCost: newCost,
                            shippingVatRate: selectedPO.shippingVatRate,
                          });
                        }
                      }}
                      data-testid="input-edit-shipping"
                    />
                  </div>
                  <div>
                    <Label>Shipping VAT %</Label>
                    <Select 
                      defaultValue={selectedPO.shippingVatRate}
                      onValueChange={(value) => {
                        updateShippingMutation.mutate({
                          poId: selectedPO.id,
                          shippingCost: selectedPO.shippingCost,
                          shippingVatRate: value,
                        });
                      }}
                    >
                      <SelectTrigger data-testid="select-edit-shipping-vat">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0% (No VAT)</SelectItem>
                        <SelectItem value="13.5">13.5%</SelectItem>
                        <SelectItem value="23">23%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="space-y-1 text-right w-56 bg-muted p-4 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatCurrency(selectedPO.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Items VAT:</span>
                    <span>{formatCurrency(parseFloat(selectedPO.vatTotal) - parseFloat(selectedPO.shippingVat || "0"))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping:</span>
                    <span>{formatCurrency(selectedPO.shippingCost)}</span>
                  </div>
                  {parseFloat(selectedPO.shippingVat || "0") > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping VAT:</span>
                      <span>{formatCurrency(selectedPO.shippingVat)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold">
                    <span>Total:</span>
                    <span>{formatCurrency(selectedPO.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowEditDialog(false)} data-testid="button-close-edit">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
