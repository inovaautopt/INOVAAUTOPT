import { requireStaff, withStaff } from "@/server/auth";
import { PageHeader } from "@/components/admin/ui";
import { ActionForm, FieldMsg } from "@/components/admin/ActionForm";
import { createManualLeadAction } from "../actions";

export default async function NewLead() {
  await requireStaff(["admin", "sales"]);
  const vehicles = await withStaff(undefined, async (tx) => (await tx`select id, reference, make, model from app.vehicles where status in ('available', 'reserved') order by reference`) as unknown as { id: string; reference: string; make: string; model: string }[]);
  return (
    <>
      <PageHeader title="Registar contacto" description="Para pedidos recebidos por telefone, presencialmente, por email ou WhatsApp." />
      <div className="panel max-w-2xl p-5">
        <ActionForm action={createManualLeadAction} submitLabel="Registar">
          <>
            <>
              <div>
                <label className="field-label" htmlFor="name">Nome</label>
                <input id="name" name="name" className="input" required />
                <FieldMsg name="name" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="phone">Telefone</label>
                  <input id="phone" name="phone" className="input" type="tel" />
                  <FieldMsg name="phone" />
                </div>
                <div>
                  <label className="field-label" htmlFor="email">Email</label>
                  <input id="email" name="email" className="input" type="email" />
                  <FieldMsg name="email" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="source">Origem</label>
                  <select id="source" name="source" className="input" defaultValue="phone">
                    <option value="phone">Telefone</option>
                    <option value="walk_in">Presencial</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="other">Outra</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="vehicleId">Viatura</label>
                  <select id="vehicleId" name="vehicleId" className="input" defaultValue="">
                    <option value="">—</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.reference} · {v.make} {v.model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="message">Notas do pedido</label>
                <textarea id="message" name="message" className="input" />
              </div>
            </>
          </>
        </ActionForm>
      </div>
    </>
  );
}
