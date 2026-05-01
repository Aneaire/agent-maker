"use client";

import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/nextjs";
import { ConvexProviderWithAuth } from "convex/react";
import { ConvexReactClient } from "convex/react";
import { useState, useCallback, useMemo } from "react";

function useAuthFromClerk() {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        return await getToken({
          template: "convex",
          skipCache: forceRefreshToken,
        });
      } catch {
        return null;
      }
    },
    [getToken]
  );
  return useMemo(
    () => ({
      isLoading: !isLoaded,
      isAuthenticated: isSignedIn ?? false,
      fetchAccessToken,
    }),
    [isLoaded, isSignedIn, fetchAccessToken]
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [convex] = useState(
    () => new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  );

  return (
    <ClerkProvider>
      <ConvexProviderWithAuth client={convex} useAuth={useAuthFromClerk}>
        {children}
      </ConvexProviderWithAuth>
    </ClerkProvider>
  );
}
