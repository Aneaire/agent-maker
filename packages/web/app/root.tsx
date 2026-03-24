import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/react";
import { ConvexProviderWithAuth } from "convex/react";
import { ConvexReactClient } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import "./styles.css";

/* ── Clerk dark theme matching our zinc-950 + neon-400 branding ────── */
const clerkAppearance = {
  variables: {
    colorPrimary: "#34d399",
    colorText: "#e4e4e7",
    colorTextSecondary: "#a1a1aa",
    colorBackground: "#0c0c0e",
    colorInputBackground: "#18181b",
    colorInputText: "#e4e4e7",
    colorTextOnPrimaryBackground: "#09090b",
    borderRadius: "0.75rem",
    fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
    colorDanger: "#f87171",
    colorSuccess: "#34d399",
    colorWarning: "#fbbf24",
    spacingUnit: "4px",
    fontSize: "14px",
  },
  elements: {
    // ── Root card ───────────────────────────────────────
    card: {
      backgroundColor: "#0c0c0e",
      border: "1px solid rgba(63, 63, 70, 0.5)",
      boxShadow:
        "0 0 60px rgba(16, 185, 129, 0.06), 0 25px 50px -12px rgba(0, 0, 0, 0.6)",
      borderRadius: "1rem",
    },
    rootBox: {
      width: "100%",
    },

    // ── Header ──────────────────────────────────────────
    headerTitle: {
      color: "#f4f4f5",
      fontWeight: "700",
      fontSize: "1.25rem",
    },
    headerSubtitle: {
      color: "#71717a",
    },
    logoBox: {
      height: "36px",
    },

    // ── Social buttons ──────────────────────────────────
    socialButtonsBlockButton: {
      backgroundColor: "#18181b",
      border: "1px solid rgba(63, 63, 70, 0.6)",
      color: "#d4d4d8",
      borderRadius: "0.75rem",
      transition: "all 0.2s ease",
      "&:hover": {
        backgroundColor: "#27272a",
        borderColor: "rgba(82, 82, 91, 0.8)",
      },
    },
    socialButtonsBlockButtonText: {
      color: "#d4d4d8",
      fontWeight: "500",
    },
    socialButtonsProviderIcon: {
      width: "20px",
      height: "20px",
    },

    // ── Divider ─────────────────────────────────────────
    dividerLine: {
      backgroundColor: "rgba(63, 63, 70, 0.4)",
    },
    dividerText: {
      color: "#52525b",
      fontSize: "12px",
    },

    // ── Form fields ─────────────────────────────────────
    formFieldLabel: {
      color: "#a1a1aa",
      fontSize: "13px",
      fontWeight: "500",
    },
    formFieldInput: {
      backgroundColor: "#18181b",
      border: "1px solid rgba(63, 63, 70, 0.6)",
      color: "#e4e4e7",
      borderRadius: "0.75rem",
      transition: "all 0.2s ease",
      "&:focus": {
        borderColor: "rgba(52, 211, 153, 0.4)",
        boxShadow:
          "0 0 0 3px rgba(52, 211, 153, 0.08), 0 0 20px rgba(52, 211, 153, 0.04)",
      },
    },

    // ── Primary button ──────────────────────────────────
    formButtonPrimary: {
      background: "linear-gradient(135deg, #10b981, #34d399)",
      color: "#09090b",
      fontWeight: "600",
      borderRadius: "0.75rem",
      boxShadow:
        "0 0 20px rgba(16, 185, 129, 0.15), 0 0 40px rgba(16, 185, 129, 0.05)",
      transition: "all 0.2s ease",
      "&:hover": {
        background: "linear-gradient(135deg, #34d399, #6ee7b7)",
        boxShadow:
          "0 0 30px rgba(16, 185, 129, 0.25), 0 0 60px rgba(16, 185, 129, 0.08)",
      },
    },

    // ── Footer links ────────────────────────────────────
    footerActionLink: {
      color: "#34d399",
      fontWeight: "500",
      "&:hover": {
        color: "#6ee7b7",
      },
    },
    footerActionText: {
      color: "#71717a",
    },

    // ── Footer branding ─────────────────────────────────
    footerPages: {
      opacity: "0.5",
    },
    footer: {
      "& + div": {
        opacity: "0.4",
      },
    },

    // ── Internal links & text ───────────────────────────
    identityPreviewEditButton: {
      color: "#34d399",
      "&:hover": {
        color: "#6ee7b7",
      },
    },
    formFieldAction: {
      color: "#34d399",
      "&:hover": {
        color: "#6ee7b7",
      },
    },
    formResendCodeLink: {
      color: "#34d399",
      "&:hover": {
        color: "#6ee7b7",
      },
    },

    // ── Alert ───────────────────────────────────────────
    alert: {
      backgroundColor: "rgba(52, 211, 153, 0.08)",
      border: "1px solid rgba(52, 211, 153, 0.2)",
      borderRadius: "0.75rem",
    },
    alertText: {
      color: "#a1a1aa",
    },

    // ── OTP Input ───────────────────────────────────────
    otpCodeFieldInput: {
      backgroundColor: "#18181b",
      border: "1px solid rgba(63, 63, 70, 0.6)",
      color: "#e4e4e7",
      borderRadius: "0.5rem",
      "&:focus": {
        borderColor: "rgba(52, 211, 153, 0.4)",
        boxShadow: "0 0 0 3px rgba(52, 211, 153, 0.08)",
      },
    },

    // ── User button ─────────────────────────────────────
    userButtonBox: {
      borderRadius: "0.75rem",
    },
    userButtonTrigger: {
      borderRadius: "0.75rem",
      "&:focus": {
        boxShadow: "0 0 0 3px rgba(52, 211, 153, 0.15)",
      },
    },
    userButtonPopoverCard: {
      backgroundColor: "#0c0c0e",
      border: "1px solid rgba(63, 63, 70, 0.5)",
      borderRadius: "1rem",
      boxShadow:
        "0 0 40px rgba(16, 185, 129, 0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    },
    userButtonPopoverActions: {
      backgroundColor: "transparent",
    },
    userButtonPopoverActionButton: {
      color: "#d4d4d8",
      borderRadius: "0.5rem",
      "&:hover": {
        backgroundColor: "#27272a",
      },
    },
    userButtonPopoverFooter: {
      borderTop: "1px solid rgba(63, 63, 70, 0.4)",
    },

    // ── User profile ────────────────────────────────────
    profileSectionPrimaryButton: {
      color: "#34d399",
      "&:hover": {
        color: "#6ee7b7",
      },
    },
    navbarButton: {
      color: "#a1a1aa",
      "&:hover": {
        backgroundColor: "#27272a",
        color: "#e4e4e7",
      },
      "&[data-active='true']": {
        backgroundColor: "rgba(52, 211, 153, 0.08)",
        color: "#34d399",
      },
    },
    badge: {
      backgroundColor: "rgba(52, 211, 153, 0.1)",
      color: "#34d399",
      border: "1px solid rgba(52, 211, 153, 0.2)",
    },

    // ── Modal overlay ───────────────────────────────────
    modalBackdrop: {
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      backdropFilter: "blur(8px)",
    },

    // ── Select / dropdown ───────────────────────────────
    selectButton: {
      backgroundColor: "#18181b",
      border: "1px solid rgba(63, 63, 70, 0.6)",
      color: "#e4e4e7",
      "&:hover": {
        backgroundColor: "#27272a",
      },
    },
    selectOptionsContainer: {
      backgroundColor: "#0c0c0e",
      border: "1px solid rgba(63, 63, 70, 0.5)",
    },
    selectOption: {
      color: "#d4d4d8",
      "&:hover": {
        backgroundColor: "#27272a",
      },
      "&[data-selected='true']": {
        backgroundColor: "rgba(52, 211, 153, 0.08)",
        color: "#34d399",
      },
    },
  },
  layout: {
    socialButtonsPlacement: "top",
    showOptionalFields: false,
    helpPageUrl: "/docs",
    logoPlacement: "inside",
  },
};

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/logo.png" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

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

function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  const [convex] = useState(
    () => new ConvexReactClient(import.meta.env.VITE_CONVEX_URL!)
  );
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useAuthFromClerk}>
      {children}
    </ConvexProviderWithAuth>
  );
}

export default function App() {
  return (
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      appearance={clerkAppearance}
    >
      <ConvexClientProvider>
        <Outlet />
      </ConvexClientProvider>
    </ClerkProvider>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold">{error.status}</h1>
          <p className="mt-2 text-zinc-400">{error.statusText}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Error</h1>
        <p className="mt-2 text-zinc-400">Something went wrong</p>
      </div>
    </div>
  );
}
