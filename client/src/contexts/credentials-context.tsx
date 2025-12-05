import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface CredentialsStatus {
  configured: boolean;
  storeUrl: string | null;
}

interface CredentialsContextType {
  hasCredentials: boolean;
  storeUrl: string | null;
  isLoading: boolean;
  saveCredentials: (storeUrl: string, consumerKey: string, consumerSecret: string) => Promise<void>;
  deleteCredentials: () => Promise<void>;
  refreshCredentials: () => void;
}

const CredentialsContext = createContext<CredentialsContextType | undefined>(undefined);

export function CredentialsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  
  const { data, isLoading, refetch } = useQuery<CredentialsStatus>({
    queryKey: ["/api/credentials/status"],
    staleTime: 1000 * 60 * 5,
  });
  
  const hasCredentials = data?.configured ?? false;
  const storeUrl = data?.storeUrl ?? null;

  const saveMutation = useMutation({
    mutationFn: async (creds: { storeUrl: string; consumerKey: string; consumerSecret: string }) => {
      return apiRequest("POST", "/api/credentials", creds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/local-materials"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/credentials");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials/status"] });
    },
  });

  const saveCredentials = useCallback(async (storeUrl: string, consumerKey: string, consumerSecret: string) => {
    await saveMutation.mutateAsync({ storeUrl, consumerKey, consumerSecret });
  }, [saveMutation]);

  const deleteCredentials = useCallback(async () => {
    await deleteMutation.mutateAsync();
  }, [deleteMutation]);

  const refreshCredentials = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <CredentialsContext.Provider value={{ 
      hasCredentials, 
      storeUrl, 
      isLoading, 
      saveCredentials, 
      deleteCredentials,
      refreshCredentials 
    }}>
      {children}
    </CredentialsContext.Provider>
  );
}

export function useCredentials() {
  const context = useContext(CredentialsContext);
  if (context === undefined) {
    throw new Error("useCredentials must be used within a CredentialsProvider");
  }
  return context;
}
