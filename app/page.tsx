import { NavbarServer } from "@/components/ui/shadcn-io/navbar/navbar-server";
import { ChatClient } from "@/components/chat-client";

export default function Chat() {
  return (
    <div className="flex flex-col w-full h-screen">
      <NavbarServer />
      <ChatClient />
    </div>
  );
}
