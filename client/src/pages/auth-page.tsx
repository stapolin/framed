import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, BarChart3, Package, TrendingUp, ShieldCheck } from "lucide-react";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");

  if (user) {
    setLocation("/");
    return null;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username: loginUsername, password: loginPassword });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (registerPassword !== registerConfirmPassword) {
      return;
    }
    registerMutation.mutate({ username: registerUsername, password: registerPassword });
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">WooCommerce Reports</CardTitle>
            <CardDescription>Sign in to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" data-testid="tab-login">Login</TabsTrigger>
                <TabsTrigger value="register" data-testid="tab-register">Register</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Username</Label>
                    <Input
                      id="login-username"
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="Enter your username"
                      required
                      data-testid="input-login-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      data-testid="input-login-password"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loginMutation.isPending}
                    data-testid="button-login"
                  >
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Username</Label>
                    <Input
                      id="register-username"
                      type="text"
                      value={registerUsername}
                      onChange={(e) => setRegisterUsername(e.target.value)}
                      placeholder="Choose a username"
                      required
                      data-testid="input-register-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      placeholder="Choose a password (min 6 characters)"
                      required
                      minLength={6}
                      data-testid="input-register-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm-password">Confirm Password</Label>
                    <Input
                      id="register-confirm-password"
                      type="password"
                      value={registerConfirmPassword}
                      onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      required
                      data-testid="input-register-confirm-password"
                    />
                    {registerPassword !== registerConfirmPassword && registerConfirmPassword && (
                      <p className="text-sm text-destructive">Passwords do not match</p>
                    )}
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={registerMutation.isPending || registerPassword !== registerConfirmPassword}
                    data-testid="button-register"
                  >
                    {registerMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="hidden lg:flex flex-1 bg-primary text-primary-foreground p-12 flex-col justify-center">
        <div className="max-w-md">
          <h1 className="text-4xl font-bold mb-6">
            WooCommerce Order Reports Dashboard
          </h1>
          <p className="text-lg mb-8 opacity-90">
            Comprehensive analytics and reporting for your WooCommerce store. 
            Track orders, manage inventory, and make data-driven decisions.
          </p>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary-foreground/10 rounded-lg">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Real-time Analytics</h3>
                <p className="text-sm opacity-80">
                  Monitor revenue, orders, and trends with interactive charts
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary-foreground/10 rounded-lg">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Inventory Management</h3>
                <p className="text-sm opacity-80">
                  Track raw materials and manage purchase orders efficiently
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary-foreground/10 rounded-lg">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Order Fulfillment</h3>
                <p className="text-sm opacity-80">
                  See which orders can be fulfilled with current stock
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary-foreground/10 rounded-lg">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Secure Access</h3>
                <p className="text-sm opacity-80">
                  Your store data is protected with secure authentication
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
