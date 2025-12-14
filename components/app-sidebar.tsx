import {
  ExternalLinkIcon,
  GithubIcon,
  LogInIcon,
  UserIcon,
} from "lucide-react";

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
  LoginLink,
  RegisterLink,
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
        {(await isAuthenticated()) ? (
          <SidebarGroup>
            <SidebarGroupLabel>Your chats</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <ConversationList />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>Login for chat history</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <span className="flex items-center gap-2">
                  <LoginLink>
                    <Button>
                      Login <LogInIcon />
                    </Button>
                  </LoginLink>
                  <RegisterLink>
                    <Button>
                      Register <UserIcon />
                    </Button>
                  </RegisterLink>
                </span>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      {(await isAuthenticated()) && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <a
                className="cursor-pointer flex items-center justify-between p-2 hover:bg-accent hover:text-accent-foreground"
                href="https://github.com/Yug34/mdlwr"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="flex items-center justify-start gap-2">
                  <GithubIcon className="w-4 h-4" />
                  Source Code
                </span>
                <ExternalLinkIcon className="w-4 h-4" />
              </a>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
