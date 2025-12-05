import { Link, useLocation } from "wouter";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { BarChart3, Settings, Package, LayoutDashboard, ShoppingCart, Building2, LogOut, User, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/">
            <div className="flex items-center gap-2 font-bold text-lg hover-elevate active-elevate-2 rounded-md px-2 py-1 -ml-2 cursor-pointer" data-testid="link-home">
              <div className="p-1.5 bg-primary/10 rounded-md">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              WooCommerce Reports
            </div>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/">
              <Button
                variant={location === "/" ? "secondary" : "ghost"}
                size="sm"
                data-testid="nav-dashboard"
              >
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <Link href="/inventory">
              <Button
                variant={location === "/inventory" || location === "/stock-ledger" ? "secondary" : "ghost"}
                size="sm"
                data-testid="nav-inventory"
              >
                <Package className="h-4 w-4 mr-2" />
                Inventory
              </Button>
            </Link>
            <Link href="/purchase-orders">
              <Button
                variant={location === "/purchase-orders" ? "secondary" : "ghost"}
                size="sm"
                data-testid="nav-purchase-orders"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Purchase Orders
              </Button>
            </Link>
            <Link href="/suppliers">
              <Button
                variant={location === "/suppliers" ? "secondary" : "ghost"}
                size="sm"
                data-testid="nav-suppliers"
              >
                <Building2 className="h-4 w-4 mr-2" />
                Suppliers
              </Button>
            </Link>
            <Link href="/customers">
              <Button
                variant={location === "/customers" ? "secondary" : "ghost"}
                size="sm"
                data-testid="nav-customers"
              >
                <Users className="h-4 w-4 mr-2" />
                Customers
              </Button>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/settings">
            <Button
              variant={location === "/settings" ? "secondary" : "ghost"}
              size="icon"
              data-testid="button-settings"
            >
              <Settings className="h-5 w-5" />
              <span className="sr-only">Settings</span>
            </Button>
          </Link>
          <ThemeToggle />
          
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-user-menu">
                  <User className="h-5 w-5" />
                  <span className="sr-only">User menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 text-sm font-medium">
                  {user.username}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logoutMutation.mutate()}
                  className="cursor-pointer"
                  data-testid="button-logout"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
