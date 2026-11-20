import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export default async function AdminHome() {
  await requireRole(["admin"]);
  redirect("/admin/users");
}
