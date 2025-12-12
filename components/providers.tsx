"use client";

import type { ReactNode } from "react";
import { KindeProvider } from "@kinde-oss/kinde-auth-react";
import { SidebarProvider } from "@/components/ui/sidebar";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <KindeProvider
      clientId={process.env.NEXT_PUBLIC_KINDE_CLIENT_ID!}
      domain={process.env.NEXT_PUBLIC_KINDE_DOMAIN!}
      redirectUri={process.env.NEXT_PUBLIC_KINDE_REDIRECT_URI!}
      logoutUri={process.env.NEXT_PUBLIC_KINDE_LOGOUT_URI}
    >
      <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>
    </KindeProvider>
  );
}
