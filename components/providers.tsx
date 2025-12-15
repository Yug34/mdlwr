"use client";

import type { ReactNode } from "react";
import { KindeProvider } from "@kinde-oss/kinde-auth-react";
import { SidebarProvider } from "@/components/ui/sidebar";

export function Providers({ children }: { children: ReactNode }) {
  const redirectUri = process.env.NEXT_PUBLIC_KINDE_REDIRECT_URI!;
  const logoutUri = process.env.KINDE_POST_LOGOUT_REDIRECT_URL;
  return (
    <KindeProvider
      clientId={process.env.NEXT_PUBLIC_KINDE_CLIENT_ID!}
      domain={process.env.NEXT_PUBLIC_KINDE_DOMAIN!}
      redirectUri={redirectUri}
      logoutUri={logoutUri}
    >
      <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>
    </KindeProvider>
  );
}
