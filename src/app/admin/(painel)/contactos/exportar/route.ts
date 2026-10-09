import { NextResponse } from "next/server";
import { withStaff, AuthError } from "@/server/auth";
import { toCsv } from "@/lib/csv";

/** Exportação de contactos: só administradores; fica registada na auditoria. */
export async function GET() {
  try {
    const csv = await withStaff(["admin"], async (tx, s) => {
      const rows = (await tx`select l.created_at, l.name, l.email, l.phone_e164, l.kind, l.source, l.status, l.vehicle_reference, p.full_name as assignee, l.lost_reason
        from app.leads l left join app.profiles p on p.id = l.assigned_to order by l.created_at desc limit 10000`) as unknown as Record<string, unknown>[];
      await tx`select app.write_audit('export', 'leads', null, ${tx.json({ rows: rows.length, by: s.profile.email })})`;
      return toCsv(
        ["Recebido", "Nome", "Email", "Telefone", "Tipo", "Origem", "Estado", "Viatura", "Responsável", "Motivo de perda"],
        rows.map((r) => [r.createdAt, r.name, r.email, r.phoneE164, r.kind, r.source, r.status, r.vehicleReference, r.assignee, r.lostReason]),
      );
    });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contactos-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AuthError) return new NextResponse("Sem permissão", { status: 403 });
    throw err;
  }
}
