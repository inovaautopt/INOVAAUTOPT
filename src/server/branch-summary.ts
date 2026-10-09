import "server-only";
import type { Tx } from "@/lib/db";

export async function getBranchSummary(tx: Tx, branchId: string): Promise<string | null> {
  const [b] = (await tx`select name, address_line, postal_code, city from app.branches where id = ${branchId}`) as unknown as { name: string; addressLine: string | null; postalCode: string | null; city: string | null }[];
  if (!b) return null;
  return [b.name, b.addressLine, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}
