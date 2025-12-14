"use client";

import { Inbox, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export function SidebarMenuItems() {
  const router = useRouter();

  // Menu items.
  const items = [
    {
      title: "New Chat",
      icon: Plus,
      onClick: () => {
        // Navigate to root to start a new conversation
        router.push("/");
      },
    },
  ];

  return (
    <>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild>
            <button onClick={item.onClick} className="cursor-pointer">
              <item.icon />
              <span>{item.title}</span>
            </button>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </>
  );
}
