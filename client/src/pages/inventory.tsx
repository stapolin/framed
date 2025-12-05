import { useQuery, useMutation } from "@tanstack/react-query";
import { useCredentials } from "@/contexts/credentials-context";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Package, 
  Link as LinkIcon, 
  Trash2, 
  AlertTriangle,
  CheckCircle,
  Plus,
  Search,
  History,
  TruckIcon,
  Loader2,
  ClipboardEdit,
  ChevronRight,
  ChevronDown,
  Layers,
  Settings2,
  Check,
  Pencil
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LocalRawMaterial, LocalRawMaterialVariation, LocalRawMaterialWithVariations, MaterialProductMapping } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Download } from "lucide-react";

interface EnrichedMapping extends MaterialProductMapping {
  materialName?: string;
  productName?: string;
  variationName?: string;
}

interface ProductVariationSelection {
  productId: number;
  productName: string;
  variationId: number;
  variationName: string;
  quantityUsed: number;
  selected: boolean;
  alreadyMapped: boolean;
  existingMappingId?: number;
}

interface ProductWithVariations {
  id: number;
  name: string;
  type: string;
  sku: string;
  variations: Array<{ id: number; name: string; sku?: string }>;
}

export default function Inventory() {
  const { hasCredentials } = useCredentials();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [showManageMappingsDialog, setShowManageMappingsDialog] = useState(false);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [showStockTakeDialog, setShowStockTakeDialog] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<LocalRawMaterialWithVariations | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<LocalRawMaterialVariation | null>(null);
  const [selectedMaterialVariation, setSelectedMaterialVariation] = useState<LocalRawMaterialVariation | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedVariationId, setSelectedVariationId] = useState<string>("");
  const [quantityUsed, setQuantityUsed] = useState<number>(1);
  const [stockQuantity, setStockQuantity] = useState<number>(1);
  const [stockNotes, setStockNotes] = useState<string>("");
  const [stockTakeLevel, setStockTakeLevel] = useState<number>(0);
  const [stockTakeNotes, setStockTakeNotes] = useState<string>("");
  const [bulkMappingSearch, setBulkMappingSearch] = useState<string>("");
  const [bulkSelections, setBulkSelections] = useState<Map<string, ProductVariationSelection>>(new Map());
  const [defaultQuantity, setDefaultQuantity] = useState<number>(1);
  const [editingMappingId, setEditingMappingId] = useState<number | null>(null);
  const [editingQuantity, setEditingQuantity] = useState<number>(1);

  const { data: localMaterials, isLoading: materialsLoading } = useQuery<LocalRawMaterialWithVariations[]>({
    queryKey: ["/api/local-materials"],
  });

  const importFromWooCommerceMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/local-materials/import-from-woocommerce");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/local-materials"] });
      toast({
        title: "Import Complete",
        description: data.message || `Imported ${data.imported} materials.`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message || "Failed to import from WooCommerce",
      });
    },
  });

  const { data: productsWithVariations, isLoading: productsWithVariationsLoading } = useQuery<ProductWithVariations[]>({
    queryKey: ["/api/products-with-variations"],
    enabled: hasCredentials,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: variations, isLoading: variationsLoading } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/products", selectedProductId, "variations"],
    queryFn: async () => {
      const response = await fetch(`/api/products/${selectedProductId}/variations`);
      if (!response.ok) throw new Error("Failed to fetch variations");
      return response.json();
    },
    enabled: !!selectedProductId && hasCredentials,
  });

  const { data: mappings, isLoading: mappingsLoading } = useQuery<MaterialProductMapping[]>({
    queryKey: ["/api/material-mappings"],
    queryFn: async () => {
      const response = await fetch("/api/material-mappings");
      if (!response.ok) throw new Error("Failed to fetch mappings");
      return response.json();
    },
  });

  const createMappingMutation = useMutation({
    mutationFn: async (data: { 
      materialProductId: number; 
      materialVariationId?: number | null;
      productId: number; 
      variationId: number; 
      quantityUsed: number;
    }) => {
      return apiRequest("POST", "/api/material-mappings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-mappings"] });
      setShowMappingDialog(false);
      setSelectedMaterial(null);
      setSelectedMaterialVariation(null);
      setSelectedProductId("");
      setSelectedVariationId("");
      setQuantityUsed(1);
      toast({
        title: "Mapping Created",
        description: "The product variation has been linked to the raw material.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create mapping",
      });
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/material-mappings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-mappings"] });
      toast({
        title: "Mapping Deleted",
        description: "The product mapping has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete mapping",
      });
    },
  });

  const bulkCreateMappingsMutation = useMutation({
    mutationFn: async (data: { 
      materialProductId: number; 
      materialVariationId: number | null;
      targets: Array<{ productId: number; variationId: number | null; quantityUsed: number }>;
    }) => {
      return apiRequest("POST", "/api/material-mappings/bulk", data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-mappings"] });
      setShowMappingDialog(false);
      setBulkSelections(new Map());
      setBulkMappingSearch("");
      setDefaultQuantity(1);
      const count = Array.isArray(data) ? data.length : 0;
      toast({
        title: "Mappings Created",
        description: `Successfully created ${count} product mapping${count !== 1 ? 's' : ''}.`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create mappings",
      });
    },
  });

  const updateMappingMutation = useMutation({
    mutationFn: async (data: { id: number; quantityUsed: number }) => {
      return apiRequest("PATCH", `/api/material-mappings/${data.id}`, { quantityUsed: data.quantityUsed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-mappings"] });
      setEditingMappingId(null);
      toast({
        title: "Mapping Updated",
        description: "The quantity used has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update mapping",
      });
    },
  });

  // Add stock mutation for simple products
  const addStockMutation = useMutation({
    mutationFn: async (data: { materialId: number; quantity: number; notes: string }) => {
      const response = await fetch(`/api/local-materials/${data.materialId}/add-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: data.quantity, notes: data.notes || "Stock received from supplier" }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add stock");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/local-materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-ledger"] });
      setShowStockDialog(false);
      setSelectedMaterial(null);
      setSelectedVariation(null);
      setStockQuantity(1);
      setStockNotes("");
      toast({
        title: "Stock Added",
        description: `Added ${data.quantityAdded} units. New stock: ${data.newStock}`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error Adding Stock",
        description: error.message || "Failed to add stock",
      });
    },
  });

  // Add stock mutation for variations
  const addVariationStockMutation = useMutation({
    mutationFn: async (data: { materialId: number; variationId: number; quantity: number; notes: string }) => {
      const response = await fetch(`/api/local-materials/${data.materialId}/variations/${data.variationId}/add-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: data.quantity, notes: data.notes || "Stock received from supplier" }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add variation stock");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/local-materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-ledger"] });
      setShowStockDialog(false);
      setSelectedMaterial(null);
      setSelectedVariation(null);
      setStockQuantity(1);
      setStockNotes("");
      toast({
        title: "Stock Added",
        description: `Added ${data.quantityAdded} units to ${data.variationName}. New stock: ${data.newStock}`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error Adding Stock",
        description: error.message || "Failed to add variation stock",
      });
    },
  });

  // Set stock mutation for simple products
  const setStockMutation = useMutation({
    mutationFn: async (data: { materialId: number; newStockLevel: number; notes: string }) => {
      const response = await fetch(`/api/local-materials/${data.materialId}/set-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStockLevel: data.newStockLevel, notes: data.notes || "Stock take adjustment" }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to set stock");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/local-materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-ledger"] });
      setShowStockTakeDialog(false);
      setSelectedMaterial(null);
      setSelectedVariation(null);
      setStockTakeLevel(0);
      setStockTakeNotes("");
      const changeText = data.quantityChange > 0 ? `+${data.quantityChange}` : data.quantityChange.toString();
      toast({
        title: "Stock Updated",
        description: `Stock set to ${data.newStock} (${changeText} units)`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error Updating Stock",
        description: error.message || "Failed to set stock level",
      });
    },
  });

  // Set stock mutation for variations
  const setVariationStockMutation = useMutation({
    mutationFn: async (data: { materialId: number; variationId: number; newStockLevel: number; notes: string }) => {
      const response = await fetch(`/api/local-materials/${data.materialId}/variations/${data.variationId}/set-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStockLevel: data.newStockLevel, notes: data.notes || "Stock take adjustment" }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to set variation stock");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/local-materials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-ledger"] });
      setShowStockTakeDialog(false);
      setSelectedMaterial(null);
      setSelectedVariation(null);
      setStockTakeLevel(0);
      setStockTakeNotes("");
      const changeText = data.quantityChange > 0 ? `+${data.quantityChange}` : data.quantityChange.toString();
      toast({
        title: "Stock Updated",
        description: `${data.variationName} stock set to ${data.newStock} (${changeText} units)`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error Updating Stock",
        description: error.message || "Failed to set variation stock level",
      });
    },
  });

  const handleAddStock = () => {
    if (stockQuantity <= 0) return;
    
    if (selectedVariation && selectedMaterial) {
      addVariationStockMutation.mutate({
        materialId: selectedMaterial.id,
        variationId: selectedVariation.id,
        quantity: stockQuantity,
        notes: stockNotes,
      });
    } else if (selectedMaterial) {
      addStockMutation.mutate({
        materialId: selectedMaterial.id,
        quantity: stockQuantity,
        notes: stockNotes,
      });
    }
  };

  const handleSetStock = () => {
    if (stockTakeLevel < 0) return;
    
    if (selectedVariation && selectedMaterial) {
      setVariationStockMutation.mutate({
        materialId: selectedMaterial.id,
        variationId: selectedVariation.id,
        newStockLevel: stockTakeLevel,
        notes: stockTakeNotes,
      });
    } else if (selectedMaterial) {
      setStockMutation.mutate({
        materialId: selectedMaterial.id,
        newStockLevel: stockTakeLevel,
        notes: stockTakeNotes,
      });
    }
  };

  const getStockBadge = (stock: number | null | undefined, manageStock: boolean) => {
    if (!manageStock) {
      return <Badge variant="outline">Not Tracked</Badge>;
    }
    if (stock === null || stock === undefined) {
      return <Badge variant="outline">Unknown</Badge>;
    }
    if (stock <= 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (stock <= 10) {
      return <Badge className="bg-amber-500 hover:bg-amber-600">Low ({stock})</Badge>;
    }
    return <Badge className="bg-green-600 hover:bg-green-700">{stock}</Badge>;
  };

  const getStockStatus = (stock: number | null | undefined, manageStock: boolean): "ok" | "low" | "out" | "unknown" => {
    if (!manageStock) return "unknown";
    if (stock === null || stock === undefined) return "unknown";
    if (stock <= 0) return "out";
    if (stock <= 10) return "low";
    return "ok";
  };

  const toggleExpanded = (productId: number) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const filteredMaterials = localMaterials?.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (material.sku && material.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const getMaterialMappings = (materialId: number): EnrichedMapping[] => {
    const materialMappings = mappings?.filter(m => m.materialProductId === materialId) || [];
    return materialMappings.map(mapping => {
      const product = productsWithVariations?.find(p => p.id === mapping.productId);
      const variation = product?.variations?.find(v => v.id === mapping.variationId);
      return {
        ...mapping,
        materialName: localMaterials?.find(m => m.id === mapping.materialProductId)?.name,
        productName: product?.name,
        variationName: variation?.name || `Variation #${mapping.variationId}`,
      };
    });
  };

  const handleCreateMapping = () => {
    if (!selectedMaterial || !selectedProductId || !selectedVariationId) return;
    
    createMappingMutation.mutate({
      materialProductId: selectedMaterial.id,
      materialVariationId: selectedMaterialVariation?.id || null,
      productId: parseInt(selectedProductId),
      variationId: parseInt(selectedVariationId),
      quantityUsed,
    });
  };

  const handleBulkCreateMappings = () => {
    if (!selectedMaterial) return;
    
    const selectedItems = Array.from(bulkSelections.values()).filter(s => s.selected && !s.alreadyMapped);
    if (selectedItems.length === 0) return;

    const targets = selectedItems.map(item => ({
      productId: item.productId,
      variationId: item.variationId,
      quantityUsed: item.quantityUsed,
    }));

    bulkCreateMappingsMutation.mutate({
      materialProductId: selectedMaterial.id,
      materialVariationId: selectedMaterialVariation?.id || null,
      targets,
    });
  };

  const initializeBulkSelections = (material: LocalRawMaterialWithVariations, materialVariation?: LocalRawMaterialVariation | null) => {
    const existingMappings = mappings?.filter(m => 
      m.materialProductId === material.id && 
      (materialVariation ? m.materialVariationId === materialVariation.id : m.materialVariationId === null)
    ) || [];

    const newSelections = new Map<string, ProductVariationSelection>();
    
    if (productsWithVariations) {
      for (const product of productsWithVariations) {
        for (const variation of product.variations) {
          const key = `${product.id}-${variation.id}`;
          const existingMapping = existingMappings.find(
            m => m.productId === product.id && m.variationId === variation.id
          );
          
          newSelections.set(key, {
            productId: product.id,
            productName: product.name,
            variationId: variation.id,
            variationName: variation.name || `Variation #${variation.id}`,
            quantityUsed: existingMapping?.quantityUsed || defaultQuantity,
            selected: false,
            alreadyMapped: !!existingMapping,
            existingMappingId: existingMapping?.id,
          });
        }
      }
    }
    
    setBulkSelections(newSelections);
  };

  const openMappingDialog = (material: LocalRawMaterialWithVariations, materialVariation?: LocalRawMaterialVariation) => {
    setSelectedMaterial(material);
    setSelectedMaterialVariation(materialVariation || null);
    setSelectedProductId("");
    setSelectedVariationId("");
    setQuantityUsed(1);
    setDefaultQuantity(1);
    setBulkMappingSearch("");
    setBulkSelections(new Map());
    setShowMappingDialog(true);
  };

  useEffect(() => {
    if (showMappingDialog && selectedMaterial && productsWithVariations && mappings) {
      initializeBulkSelections(selectedMaterial, selectedMaterialVariation);
    }
  }, [showMappingDialog, selectedMaterial?.id, selectedMaterialVariation?.id, productsWithVariations, mappings]);

  const openManageMappingsDialog = (material: LocalRawMaterialWithVariations, materialVariation?: LocalRawMaterialVariation) => {
    setSelectedMaterial(material);
    setSelectedMaterialVariation(materialVariation || null);
    setEditingMappingId(null);
    setShowManageMappingsDialog(true);
  };

  const toggleVariationSelection = (key: string) => {
    setBulkSelections(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(key);
      if (item && !item.alreadyMapped) {
        newMap.set(key, { ...item, selected: !item.selected });
      }
      return newMap;
    });
  };

  const updateVariationQuantity = (key: string, quantity: number) => {
    setBulkSelections(prev => {
      const newMap = new Map(prev);
      const item = newMap.get(key);
      if (item) {
        newMap.set(key, { ...item, quantityUsed: Math.max(1, quantity) });
      }
      return newMap;
    });
  };

  const selectAllVisible = () => {
    setBulkSelections(prev => {
      const newMap = new Map(prev);
      const filteredKeys = Array.from(prev.entries())
        .filter(([_, item]) => {
          if (item.alreadyMapped) return false;
          if (!bulkMappingSearch) return true;
          const searchLower = bulkMappingSearch.toLowerCase();
          return item.productName.toLowerCase().includes(searchLower) || 
                 item.variationName.toLowerCase().includes(searchLower);
        })
        .map(([key]) => key);
      
      filteredKeys.forEach(key => {
        const item = newMap.get(key);
        if (item && !item.alreadyMapped) {
          newMap.set(key, { ...item, selected: true });
        }
      });
      return newMap;
    });
  };

  const deselectAll = () => {
    setBulkSelections(prev => {
      const newMap = new Map(prev);
      prev.forEach((item, key) => {
        newMap.set(key, { ...item, selected: false });
      });
      return newMap;
    });
  };

  const getMaterialMappingsForDialog = (): EnrichedMapping[] => {
    if (!selectedMaterial) return [];
    const materialMappings = mappings?.filter(m => 
      m.materialProductId === selectedMaterial.id &&
      (selectedMaterialVariation ? m.materialVariationId === selectedMaterialVariation.id : m.materialVariationId === null)
    ) || [];
    
    return materialMappings.map(mapping => {
      const product = productsWithVariations?.find(p => p.id === mapping.productId);
      const variation = product?.variations?.find((v: { id: number; name: string }) => v.id === mapping.variationId);
      return {
        ...mapping,
        materialName: selectedMaterial.name,
        productName: product?.name || `Product #${mapping.productId}`,
        variationName: variation?.name || `Variation #${mapping.variationId}`,
      };
    });
  };

  const openAddStockDialog = (material: LocalRawMaterialWithVariations, variation?: LocalRawMaterialVariation) => {
    setSelectedMaterial(material);
    setSelectedVariation(variation || null);
    setStockQuantity(1);
    setStockNotes("");
    setShowStockDialog(true);
  };

  const openStockTakeDialog = (material: LocalRawMaterialWithVariations, variation?: LocalRawMaterialVariation) => {
    setSelectedMaterial(material);
    setSelectedVariation(variation || null);
    setStockTakeLevel(variation?.stockQuantity ?? material.stockQuantity ?? 0);
    setStockTakeNotes("");
    setShowStockTakeDialog(true);
  };

  if (!hasCredentials) {
    return (
      <main className="container mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Configure WooCommerce</CardTitle>
            <CardDescription>
              Please configure your WooCommerce credentials in Settings to view inventory.
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

  const isAddingStock = addStockMutation.isPending || addVariationStockMutation.isPending;
  const isSettingStock = setStockMutation.isPending || setVariationStockMutation.isPending;
  const currentStock = selectedVariation?.stockQuantity ?? selectedMaterial?.stockQuantity ?? 0;

  return (
    <main className="container mx-auto px-6 py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-inventory-title">Raw Materials Inventory</h1>
            <p className="text-muted-foreground">
              Manage your raw materials stock and product mappings
            </p>
          </div>
          <Link href="/stock-ledger">
            <Button variant="outline" data-testid="button-view-ledger">
              <History className="mr-2 h-4 w-4" />
              Stock Ledger
            </Button>
          </Link>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-materials"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={() => importFromWooCommerceMutation.mutate()}
            disabled={importFromWooCommerceMutation.isPending || !hasCredentials}
            data-testid="button-import-from-woo"
          >
            {importFromWooCommerceMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Import from WooCommerce
          </Button>
        </div>

        {materialsLoading ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mappings</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : filteredMaterials && filteredMaterials.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mappings</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMaterials.map(material => {
                    const isVariable = material.type === "variable" && material.variations && material.variations.length > 0;
                    const materialMappings = getMaterialMappings(material.id);
                    const isExpanded = expandedProducts.has(material.id);
                    const hasLowStock = isVariable 
                      ? material.variations?.some(v => getStockStatus(v.stockQuantity, v.manageStock) === "low" || getStockStatus(v.stockQuantity, v.manageStock) === "out")
                      : getStockStatus(material.stockQuantity, material.manageStock) !== "ok";
                    
                    return (
                      <Collapsible key={material.id} open={isExpanded} asChild>
                        <>
                          <TableRow 
                            className={isVariable ? "cursor-pointer hover:bg-muted/50" : ""}
                            data-testid={`row-material-${material.id}`}
                          >
                            <TableCell>
                              {isVariable ? (
                                <CollapsibleTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6"
                                    onClick={() => toggleExpanded(material.id)}
                                    data-testid={`button-expand-${material.id}`}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                              ) : (
                                <Package className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {isVariable && (
                                  <Badge variant="outline" className="text-xs">
                                    <Layers className="h-3 w-3 mr-1" />
                                    {material.variations?.length}
                                  </Badge>
                                )}
                                <span className="font-medium">{material.name}</span>
                                {hasLowStock && isVariable && (
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {material.sku || "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              {isVariable ? (
                                <span className="font-medium">
                                  {material.variations?.reduce((sum, v) => sum + (v.stockQuantity ?? 0), 0) ?? 0}
                                </span>
                              ) : (
                                <span className="font-medium">{material.stockQuantity ?? 0}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {isVariable ? (
                                <Badge variant="outline">Variable</Badge>
                              ) : (
                                getStockBadge(material.stockQuantity, material.manageStock)
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {materialMappings.length > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openManageMappingsDialog(material)}
                                    data-testid={`button-manage-mappings-${material.id}`}
                                  >
                                    <Settings2 className="h-4 w-4 mr-1" />
                                    {materialMappings.length} Mapping{materialMappings.length !== 1 ? 's' : ''}
                                  </Button>
                                )}
                                {!isVariable && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openMappingDialog(material)}
                                    data-testid={`button-add-mapping-${material.id}`}
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Map
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {!isVariable && material.manageStock && (
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openAddStockDialog(material)}
                                    data-testid={`button-add-stock-${material.id}`}
                                  >
                                    <TruckIcon className="h-4 w-4 mr-1" />
                                    Add
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openStockTakeDialog(material)}
                                    data-testid={`button-edit-stock-${material.id}`}
                                  >
                                    <ClipboardEdit className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                          
                          {isVariable && (
                            <CollapsibleContent asChild>
                              <>
                                {material.variations?.map(variation => (
                                  <TableRow 
                                    key={variation.id} 
                                    className="bg-muted/30"
                                    data-testid={`row-variation-${variation.id}`}
                                  >
                                    <TableCell></TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2 pl-6">
                                        <span className="text-muted-foreground">└</span>
                                        <span>{variation.name}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {variation.sku || "-"}
                                    </TableCell>
                                    <TableCell className="text-center font-medium">
                                      {variation.stockQuantity ?? 0}
                                    </TableCell>
                                    <TableCell>
                                      {getStockBadge(variation.stockQuantity, variation.manageStock)}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        {(mappings?.filter(m => 
                                          m.materialProductId === material.id && 
                                          m.materialVariationId === variation.id
                                        )?.length ?? 0) > 0 && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openManageMappingsDialog(material, variation)}
                                            data-testid={`button-manage-mappings-variation-${variation.id}`}
                                          >
                                            <Settings2 className="h-4 w-4 mr-1" />
                                            {mappings?.filter(m => 
                                              m.materialProductId === material.id && 
                                              m.materialVariationId === variation.id
                                            )?.length ?? 0}
                                          </Button>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => openMappingDialog(material, variation)}
                                          data-testid={`button-add-mapping-variation-${variation.id}`}
                                        >
                                          <Plus className="h-4 w-4 mr-1" />
                                          Map
                                        </Button>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {variation.manageStock && (
                                        <div className="flex items-center justify-end gap-1">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openAddStockDialog(material, variation)}
                                            data-testid={`button-add-stock-variation-${variation.id}`}
                                          >
                                            <TruckIcon className="h-4 w-4 mr-1" />
                                            Add
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openStockTakeDialog(material, variation)}
                                            data-testid={`button-edit-stock-variation-${variation.id}`}
                                          >
                                            <ClipboardEdit className="h-4 w-4 mr-1" />
                                            Edit
                                          </Button>
                                        </div>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </>
                            </CollapsibleContent>
                          )}
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Raw Materials Found</h3>
              <p className="text-muted-foreground text-center max-w-md">
                {searchTerm 
                  ? "No materials match your search criteria. Try adjusting your search."
                  : "Click 'Import from WooCommerce' to import materials from your Raw Materials category, or add them manually."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Stock Dialog */}
      <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stock</DialogTitle>
            <DialogDescription>
              {selectedVariation 
                ? `Add stock to "${selectedMaterial?.name} - ${selectedVariation.name}"`
                : `Add stock to "${selectedMaterial?.name}"`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Stock</label>
              <p className="text-2xl font-bold">{currentStock} units</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Quantity to Add</label>
              <Input
                type="number"
                min="1"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(parseInt(e.target.value) || 1)}
                data-testid="input-add-stock-quantity"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Textarea
                value={stockNotes}
                onChange={(e) => setStockNotes(e.target.value)}
                placeholder="e.g., Supplier delivery, PO#12345"
                rows={2}
                data-testid="input-add-stock-notes"
              />
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium">
                New Stock Level: <span className="text-green-600 dark:text-green-400">{currentStock + stockQuantity}</span>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStockDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddStock}
              disabled={stockQuantity <= 0 || isAddingStock}
              data-testid="button-confirm-add-stock"
            >
              {isAddingStock ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <TruckIcon className="mr-2 h-4 w-4" />
                  Add Stock
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Take Dialog */}
      <Dialog open={showStockTakeDialog} onOpenChange={setShowStockTakeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stock Take</DialogTitle>
            <DialogDescription>
              {selectedVariation 
                ? `Set the actual stock level for "${selectedMaterial?.name} - ${selectedVariation.name}"`
                : `Set the actual stock level for "${selectedMaterial?.name}"`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Stock (System)</label>
              <p className="text-2xl font-bold">{currentStock} units</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Actual Stock Count</label>
              <Input
                type="number"
                min="0"
                value={stockTakeLevel}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setStockTakeLevel(isNaN(val) || val < 0 ? 0 : val);
                }}
                placeholder="Enter actual stock count..."
                data-testid="input-stock-take-level"
              />
              <p className="text-xs text-muted-foreground">
                Enter the actual counted stock level from your stock take
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Textarea
                value={stockTakeNotes}
                onChange={(e) => setStockTakeNotes(e.target.value)}
                placeholder="e.g., Monthly stock take, found damage, etc."
                rows={2}
                data-testid="input-stock-take-notes"
              />
            </div>

            <div className={`rounded-lg p-4 border ${
              stockTakeLevel === currentStock
                ? "bg-muted/50 border-border"
                : stockTakeLevel > currentStock
                  ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"
                  : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900"
            }`}>
              {stockTakeLevel === currentStock ? (
                <p className="text-sm font-medium text-muted-foreground">
                  No change to stock level
                </p>
              ) : (
                <p className={`text-sm font-medium ${
                  stockTakeLevel > currentStock
                    ? "text-green-800 dark:text-green-200"
                    : "text-amber-800 dark:text-amber-200"
                }`}>
                  Stock will change: {currentStock} → {stockTakeLevel} 
                  ({stockTakeLevel - currentStock > 0 ? "+" : ""}
                  {stockTakeLevel - currentStock} units)
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStockTakeDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSetStock}
              disabled={stockTakeLevel < 0 || isSettingStock}
              data-testid="button-confirm-stock-take"
            >
              {isSettingStock ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <ClipboardEdit className="mr-2 h-4 w-4" />
                  Update Stock
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Mapping Dialog */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Map Products to Material</DialogTitle>
            <DialogDescription>
              {selectedMaterial 
                ? selectedMaterialVariation
                  ? `Select product variations to link to "${selectedMaterial.name} - ${selectedMaterialVariation.name}"`
                  : `Select product variations to link to "${selectedMaterial.name}"`
                : "Select a material to link"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedMaterialVariation && (
            <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">Material Variation:</span>{" "}
                {selectedMaterialVariation.name}
              </span>
            </div>
          )}
          
          <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products or variations..."
                  value={bulkMappingSearch}
                  onChange={(e) => setBulkMappingSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-bulk-mapping-search"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">Default qty:</label>
                <Input
                  type="number"
                  min="1"
                  value={defaultQuantity}
                  onChange={(e) => setDefaultQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20"
                  data-testid="input-default-quantity"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllVisible} data-testid="button-select-all">
                <Check className="h-4 w-4 mr-1" />
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll} data-testid="button-deselect-all">
                Deselect All
              </Button>
            </div>

            <div className="flex-1 min-h-0 border rounded-md overflow-y-auto">
              <div className="p-2 space-y-1">
                {productsWithVariationsLoading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading products...
                  </div>
                ) : bulkSelections.size === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    No product variations found
                  </div>
                ) : (
                  Array.from(bulkSelections.entries())
                    .filter(([_, item]) => {
                      if (!bulkMappingSearch) return true;
                      const searchLower = bulkMappingSearch.toLowerCase();
                      return item.productName.toLowerCase().includes(searchLower) || 
                             item.variationName.toLowerCase().includes(searchLower);
                    })
                    .sort((a, b) => {
                      // Sort by product name, then variation name
                      const productCompare = a[1].productName.localeCompare(b[1].productName);
                      if (productCompare !== 0) return productCompare;
                      return a[1].variationName.localeCompare(b[1].variationName);
                    })
                    .map(([key, item]) => (
                      <div 
                        key={key} 
                        className={`flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 ${
                          item.alreadyMapped ? 'opacity-60 bg-green-50 dark:bg-green-950/20' : ''
                        }`}
                        data-testid={`mapping-item-${key}`}
                      >
                        <Checkbox
                          id={key}
                          checked={item.selected || item.alreadyMapped}
                          disabled={item.alreadyMapped}
                          onCheckedChange={() => toggleVariationSelection(key)}
                          data-testid={`checkbox-${key}`}
                        />
                        <div className="flex-1 min-w-0">
                          <label 
                            htmlFor={key}
                            className={`text-sm font-medium cursor-pointer block truncate ${
                              item.alreadyMapped ? 'cursor-not-allowed' : ''
                            }`}
                          >
                            {item.productName}
                          </label>
                          <span className="text-xs text-muted-foreground truncate block">
                            {item.variationName}
                          </span>
                        </div>
                        {item.alreadyMapped ? (
                          <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/30 shrink-0">
                            <Check className="h-3 w-3 mr-1" />
                            Mapped
                          </Badge>
                        ) : (
                          <Input
                            type="number"
                            min="1"
                            value={item.quantityUsed}
                            onChange={(e) => updateVariationQuantity(key, parseInt(e.target.value) || 1)}
                            className="w-16 h-8"
                            data-testid={`input-qty-${key}`}
                          />
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium">
                Selected: {Array.from(bulkSelections.values()).filter(s => s.selected && !s.alreadyMapped).length} new mapping{Array.from(bulkSelections.values()).filter(s => s.selected && !s.alreadyMapped).length !== 1 ? 's' : ''}
                {Array.from(bulkSelections.values()).filter(s => s.alreadyMapped).length > 0 && (
                  <span className="text-muted-foreground ml-2">
                    ({Array.from(bulkSelections.values()).filter(s => s.alreadyMapped).length} already mapped)
                  </span>
                )}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMappingDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkCreateMappings}
              disabled={
                Array.from(bulkSelections.values()).filter(s => s.selected && !s.alreadyMapped).length === 0 || 
                bulkCreateMappingsMutation.isPending
              }
              data-testid="button-confirm-bulk-mapping"
            >
              {bulkCreateMappingsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Create Mappings
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Mappings Dialog */}
      <Dialog open={showManageMappingsDialog} onOpenChange={setShowManageMappingsDialog}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Mappings</DialogTitle>
            <DialogDescription>
              {selectedMaterial 
                ? selectedMaterialVariation
                  ? `Product mappings for "${selectedMaterial.name} - ${selectedMaterialVariation.name}"`
                  : `Product mappings for "${selectedMaterial.name}"`
                : "Select a material"}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="space-y-2 py-4">
              {getMaterialMappingsForDialog().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No mappings found for this material.
                </div>
              ) : (
                getMaterialMappingsForDialog().map(mapping => (
                  <div 
                    key={mapping.id} 
                    className="flex items-center gap-3 p-3 border rounded-lg"
                    data-testid={`manage-mapping-${mapping.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{mapping.productName}</p>
                      <p className="text-xs text-muted-foreground truncate">{mapping.variationName}</p>
                    </div>
                    
                    {editingMappingId === mapping.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={editingQuantity}
                          onChange={(e) => setEditingQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-20 h-8"
                          data-testid={`input-edit-qty-${mapping.id}`}
                        />
                        <Button
                          size="sm"
                          onClick={() => updateMappingMutation.mutate({ id: mapping.id, quantityUsed: editingQuantity })}
                          disabled={updateMappingMutation.isPending}
                          data-testid={`button-save-qty-${mapping.id}`}
                        >
                          {updateMappingMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingMappingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          Qty: {mapping.quantityUsed}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingMappingId(mapping.id);
                            setEditingQuantity(mapping.quantityUsed);
                          }}
                          data-testid={`button-edit-mapping-${mapping.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteMappingMutation.mutate(mapping.id)}
                          disabled={deleteMappingMutation.isPending}
                          data-testid={`button-delete-mapping-${mapping.id}`}
                        >
                          {deleteMappingMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowManageMappingsDialog(false);
                if (selectedMaterial) {
                  openMappingDialog(selectedMaterial, selectedMaterialVariation || undefined);
                }
              }}
              data-testid="button-add-more-mappings"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add More
            </Button>
            <Button variant="outline" onClick={() => setShowManageMappingsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
