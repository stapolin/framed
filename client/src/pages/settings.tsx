import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { wooCommerceConfigSchema, type WooCommerceConfig } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCredentials } from "@/contexts/credentials-context";
import { Save, ShoppingBag, CheckCircle, Loader2, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function Settings() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { hasCredentials, storeUrl, isLoading, saveCredentials, deleteCredentials } = useCredentials();

  const form = useForm<WooCommerceConfig>({
    resolver: zodResolver(wooCommerceConfigSchema),
    defaultValues: {
      storeUrl: "",
      consumerKey: "",
      consumerSecret: "",
    },
  });

  const onSubmit = async (data: WooCommerceConfig) => {
    setIsSubmitting(true);
    try {
      await saveCredentials(data.storeUrl, data.consumerKey, data.consumerSecret);

      toast({
        title: "Settings saved",
        description: "Your WooCommerce credentials have been securely stored on the server.",
      });

      form.reset();

      setTimeout(() => {
        setLocation("/");
      }, 1000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error saving credentials",
        description: error.message || "Failed to save credentials",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCredentials = async () => {
    try {
      await deleteCredentials();
      toast({
        title: "Credentials deleted",
        description: "Your WooCommerce credentials have been removed.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete credentials",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-3xl mx-auto py-8 px-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto py-8 px-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-md">
            <ShoppingBag className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold" data-testid="text-settings-title">
            WooCommerce Settings
          </h1>
        </div>
        <p className="text-muted-foreground">
          Configure your WooCommerce store connection to start viewing order reports and analytics.
        </p>
      </div>

      {hasCredentials && (
        <Card className="mb-6 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <CardTitle className="text-green-800 dark:text-green-200">Connected</CardTitle>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {storeUrl}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-green-700 dark:text-green-300 mb-4">
              Your WooCommerce credentials are securely stored. You can update them below or delete them to disconnect.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteCredentials}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              data-testid="button-delete-credentials"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Disconnect Store
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{hasCredentials ? "Update Credentials" : "API Credentials"}</CardTitle>
          <CardDescription>
            Enter your WooCommerce REST API credentials. You can generate these in your WooCommerce dashboard under Settings → Advanced → REST API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="storeUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://yourstore.com"
                        {...field}
                        data-testid="input-store-url"
                      />
                    </FormControl>
                    <FormDescription>
                      Your WooCommerce store URL (including https://)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="consumerKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consumer Key</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ck_..."
                        {...field}
                        data-testid="input-consumer-key"
                      />
                    </FormControl>
                    <FormDescription>
                      Your WooCommerce REST API consumer key
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="consumerSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consumer Secret</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="cs_..."
                        {...field}
                        data-testid="input-consumer-secret"
                      />
                    </FormControl>
                    <FormDescription>
                      Your WooCommerce REST API consumer secret
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isSubmitting}
                  data-testid="button-save-settings"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {hasCredentials ? "Update Credentials" : "Save Credentials"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="mt-6 p-4 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-800">
        <h3 className="font-semibold mb-2 text-sm text-green-800 dark:text-green-200">Security</h3>
        <p className="text-sm text-green-700 dark:text-green-300">
          Your credentials are encrypted and stored securely on the server. They are never exposed to the browser after being saved.
        </p>
      </div>
    </div>
  );
}
