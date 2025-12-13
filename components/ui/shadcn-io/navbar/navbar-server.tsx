import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { Navbar, NavbarProps } from "./index";

export async function NavbarServer(props: NavbarProps) {
  const { getUser, isAuthenticated } = getKindeServerSession();
  const user = await getUser();
  const authenticated = await isAuthenticated();

  return (
    <Navbar
      {...props}
      isAuthenticated={authenticated}
      userEmail={user?.email ?? null}
    />
  );
}

