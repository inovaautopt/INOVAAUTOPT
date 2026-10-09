import { NextResponse } from "next/server";
import { staffOrNull } from "@/server/auth";
import { templateCsv } from "@/lib/stock-csv";

export async function GET() {
  if (!(await staffOrNull(["admin", "stock_manager"]))) return new NextResponse("Sem permissão", { status: 403 });
  return new NextResponse(templateCsv(), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="modelo-stock-inova-auto.csv"' } });
}
