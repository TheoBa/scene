import { redirect } from "next/navigation";

// No standalone landing page for now — discovery is the front door.
export default function Home() {
  redirect("/shows");
}
