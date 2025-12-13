import { ChevronUp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  getKindeServerSession,
  LogoutLink,
} from "@kinde-oss/kinde-auth-nextjs/server";
import { Button } from "./ui/button";
import { SidebarMenuItems } from "./sidebar-menu-items";
import { ConversationList } from "./conversation-list";

export async function AppSidebar() {
  const { getUser, isAuthenticated } = getKindeServerSession();
  const user = await getUser();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Create a new chat</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItems />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {(await isAuthenticated()) && (
          <SidebarGroup>
            <SidebarGroupLabel>Conversations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <ConversationList />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      {(await isAuthenticated()) && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="cursor-pointer">
                    <span className="text-sm font-medium rounded-full w-8 h-8 flex items-center justify-center border border-gray-400 border-2 leading-none">
                      {user?.given_name?.charAt(0)}
                      {user?.family_name?.charAt(0)}
                    </span>
                    <ChevronUp className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  className="w-[--radix-popper-anchor-width]"
                >
                  <DropdownMenuItem>
                    <LogoutLink>
                      <Button variant="ghost" size="sm">
                        Sign out
                      </Button>
                    </LogoutLink>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
