import { redirect } from "next/navigation";

/** The list moved to /comms; keep old links and bookmarks working. */
export default function Page() {
  redirect("/comms");
}
