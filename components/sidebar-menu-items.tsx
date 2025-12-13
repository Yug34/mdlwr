"use client";

import { Inbox, Plus } from "lucide-react";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

// Menu items.
const items = [
  {
    title: "New Chat",
    icon: Plus,
    onClick: () => {
      console.log("New Chat");
    },
  },
  {
    title: "Inbox",
    url: "#",
    icon: Inbox,
  },
];

export function SidebarMenuItems() {
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

