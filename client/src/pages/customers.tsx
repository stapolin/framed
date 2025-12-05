import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search,
  Loader2,
  Users,
  Mail,
  Phone,
  MapPin,
  Euro,
  ShoppingCart,
  User,
  Calendar,
  ArrowUpDown,
  Eye,
  Building2
} from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface Customer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  is_paying_customer: boolean;
  avatar_url: string;
  date_created: string;
  date_modified: string;
  orders_count?: number;
  total_spent?: string;
}

interface CustomerOrder {
  id: number;
  number: string;
  status: string;
  date_created: string;
  total: string;
  line_items: Array<{
    name: string;
    quantity: number;
    total: string;
  }>;
}

type SortField = "name" | "email" | "country" | "orders_count" | "total_spent";
type SortDirection = "asc" | "desc";

function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    "on-hold": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    refunded: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return statusColors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
}

function formatAddress(address: { address_1: string; address_2: string; city: string; state: string; postcode: string; country: string }): string {
  const parts = [
    address.address_1,
    address.address_2,
    address.city,
    address.state,
    address.postcode,
    address.country
  ].filter(Boolean);
  return parts.join(", ");
}

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const { data: customers, isLoading, error } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: customerOrders, isLoading: ordersLoading } = useQuery<CustomerOrder[]>({
    queryKey: ["/api/customers", selectedCustomer?.id, "orders"],
    queryFn: async () => {
      if (!selectedCustomer?.id) return [];
      const response = await fetch(`/api/customers/${selectedCustomer.id}/orders`);
      if (!response.ok) throw new Error("Failed to fetch customer orders");
      return response.json();
    },
    enabled: !!selectedCustomer?.id && showDetailsDialog,
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredAndSortedCustomers = useMemo(() => {
    if (!customers) return [];

    let result = customers;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.first_name?.toLowerCase().includes(term) ||
        c.last_name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.billing?.company?.toLowerCase().includes(term) ||
        c.billing?.city?.toLowerCase().includes(term) ||
        c.billing?.country?.toLowerCase().includes(term)
      );
    }

    result = [...result].sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (sortField === "email") {
        comparison = (a.email || "").localeCompare(b.email || "");
      } else if (sortField === "country") {
        comparison = (a.billing?.country || "").localeCompare(b.billing?.country || "");
      } else if (sortField === "orders_count") {
        comparison = (a.orders_count || 0) - (b.orders_count || 0);
      } else if (sortField === "total_spent") {
        comparison = parseFloat(a.total_spent || "0") - parseFloat(b.total_spent || "0");
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [customers, searchTerm, sortField, sortDirection]);

  const handleViewDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowDetailsDialog(true);
  };

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">
              Error loading customers: {(error as Error).message}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-page-title">
            <Users className="h-6 w-6" />
            Customers
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            View and manage customer information
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-lg">Customer List</CardTitle>
            <CardDescription>
              {isLoading ? "Loading..." : `${filteredAndSortedCustomers.length} customers`}
            </CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-customer-search"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 font-medium"
                        onClick={() => handleSort("name")}
                        data-testid="button-sort-name"
                      >
                        Name
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 font-medium"
                        onClick={() => handleSort("email")}
                        data-testid="button-sort-email"
                      >
                        Email
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 font-medium"
                        onClick={() => handleSort("country")}
                        data-testid="button-sort-country"
                      >
                        Country
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 font-medium"
                        onClick={() => handleSort("orders_count")}
                        data-testid="button-sort-orders"
                      >
                        Orders
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 font-medium"
                        onClick={() => handleSort("total_spent")}
                        data-testid="button-sort-spent"
                      >
                        Total Spent
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {searchTerm ? "No customers match your search" : "No customers found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedCustomers.map((customer) => (
                      <TableRow 
                        key={customer.id}
                        className="hover-elevate cursor-pointer"
                        onClick={() => handleViewDetails(customer)}
                        data-testid={`row-customer-${customer.id}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="font-medium" data-testid={`text-customer-name-${customer.id}`}>
                                {customer.first_name} {customer.last_name}
                              </div>
                              {customer.billing?.company && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {customer.billing.company}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground" data-testid={`text-customer-email-${customer.id}`}>
                            {customer.email}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span data-testid={`text-customer-country-${customer.id}`}>
                            {customer.billing?.country || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" data-testid={`badge-customer-orders-${customer.id}`}>
                            {customer.orders_count || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium" data-testid={`text-customer-spent-${customer.id}`}>
                          €{parseFloat(customer.total_spent || "0").toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(customer);
                            }}
                            data-testid={`button-view-customer-${customer.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Details
            </DialogTitle>
            <DialogDescription>
              Full information for {selectedCustomer?.first_name} {selectedCustomer?.last_name}
            </DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span data-testid="text-detail-customer-name">
                        {selectedCustomer.first_name} {selectedCustomer.last_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={`mailto:${selectedCustomer.email}`}
                        className="text-primary hover:underline"
                        data-testid="link-detail-customer-email"
                      >
                        {selectedCustomer.email}
                      </a>
                    </div>
                    {selectedCustomer.billing?.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a 
                          href={`tel:${selectedCustomer.billing.phone}`}
                          className="text-primary hover:underline"
                          data-testid="link-detail-customer-phone"
                        >
                          {selectedCustomer.billing.phone}
                        </a>
                      </div>
                    )}
                    {selectedCustomer.billing?.company && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span data-testid="text-detail-customer-company">
                          {selectedCustomer.billing.company}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground" data-testid="text-detail-customer-since">
                        Customer since {format(new Date(selectedCustomer.date_created), "MMM d, yyyy")}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Total Orders</span>
                      </div>
                      <Badge variant="secondary" data-testid="badge-detail-orders-count">
                        {selectedCustomer.orders_count || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Euro className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Total Spent</span>
                      </div>
                      <span className="font-semibold" data-testid="text-detail-total-spent">
                        €{parseFloat(selectedCustomer.total_spent || "0").toFixed(2)}
                      </span>
                    </div>
                    {(selectedCustomer.orders_count ?? 0) > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Average Order Value</span>
                        <span className="font-medium" data-testid="text-detail-aov">
                          €{(parseFloat(selectedCustomer.total_spent || "0") / (selectedCustomer.orders_count ?? 1)).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Billing Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground" data-testid="text-detail-billing-address">
                      {formatAddress(selectedCustomer.billing) || "No billing address"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Shipping Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground" data-testid="text-detail-shipping-address">
                      {formatAddress(selectedCustomer.shipping) || "No shipping address"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Recent Orders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ordersLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : customerOrders && customerOrders.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerOrders.slice(0, 10).map((order) => (
                            <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                              <TableCell className="font-medium" data-testid={`text-order-number-${order.id}`}>
                                #{order.number}
                              </TableCell>
                              <TableCell data-testid={`text-order-date-${order.id}`}>
                                {format(new Date(order.date_created), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  className={`${getStatusColor(order.status)} border-0`}
                                  data-testid={`badge-order-status-${order.id}`}
                                >
                                  {order.status.replace(/-/g, " ")}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium" data-testid={`text-order-total-${order.id}`}>
                                €{parseFloat(order.total).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No orders found for this customer
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
