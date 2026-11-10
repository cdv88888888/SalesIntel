import { redirect } from "next/navigation";

// Account Sync was folded into Risk & Churn; keep old bookmarks working.
export default function AccountSync() {
  redirect("/risk");
}
