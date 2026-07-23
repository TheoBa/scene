import { getSessionUser } from "@/lib/session";
import { TabNavClient } from "./TabNavClient";

// The main tab bar, shown only to signed-in users. Logged-out visitors just
// browse À l'affiche without the personal tabs.
export async function TabNav() {
  const user = await getSessionUser();
  if (!user) return null;
  return <TabNavClient />;
}
