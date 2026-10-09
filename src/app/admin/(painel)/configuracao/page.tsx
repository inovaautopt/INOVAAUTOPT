import { requireStaff, withStaff } from "@/server/auth";
import { PageHeader, Notice } from "@/components/admin/ui";
import { ActionForm, FieldMsg } from "@/components/admin/ActionForm";
import { readSettings } from "@/lib/settings";
import { SERVICES, SERVICE_LABEL } from "@/lib/domain";
import { formatPhone } from "@/lib/phone";
import { formatDate } from "@/lib/format";
import { WEEKDAYS, type Branch } from "@/lib/branches";
import { saveCompanyAction, saveServicesAction, saveLegalAction, saveCrmAction, saveBranchAction, addClosureAction } from "./actions";

function Input({ name, label, defaultValue, hint, type = "text" }: { name: string; label: string; defaultValue?: string | number | null; hint?: string; type?: string }) {
  return (
    <div>
      <label className="field-label" htmlFor={`c-${name}`}>{label}</label>
      <input id={`c-${name}`} name={name} type={type} defaultValue={defaultValue ?? ""} className="input" />
      {hint && <p className="field-hint">{hint}</p>}
      <FieldMsg name={name} />
    </div>
  );
}

export default async function Settings() {
  await requireStaff(["admin"]);
  const data = await withStaff(["admin"], async (tx) => {
    const settings = await readSettings(tx, ["company", "services", "legal", "crm"]);
    const branches = (await tx`select id, name, slug, address_line, postal_code, city, latitude::float8 as latitude, longitude::float8 as longitude, phone_e164, email, opening_hours, maps_url, is_active, is_demo
      from app.branches order by is_demo, name`) as unknown as (Branch & { isActive: boolean })[];
    const closures = (await tx`select c.closed_on::text as closed_on, c.reason, b.name from app.branch_closures c join app.branches b on b.id = c.branch_id where c.closed_on >= current_date order by c.closed_on`) as unknown as { closedOn: string; reason: string | null; name: string }[];
    return { ...settings, branches, closures };
  });
  const c = data.company;
  const missing = [!c.legalName && "firma legal", !c.nif && "NIF", !c.email && "email", !c.phoneE164 && "telefone", !data.legal.ralEntityName && "entidade de resolução de litígios", !data.legal.dataRetentionText && "prazos de conservação de dados"].filter(Boolean);
  return (
    <>
      <PageHeader title="Configuração" description="Dados comerciais e legais do stand. Nada aqui é inventado: o que ficar vazio não aparece no site." />
      {missing.length > 0 && <div className="mb-6"><Notice tone="warn">Por preencher antes do lançamento: {missing.join(", ")}.</Notice></div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="heading text-lg">Empresa e contactos</h2>
          <ActionForm action={saveCompanyAction} submitLabel="Guardar" className="mt-4">
            <>
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input name="tradeName" label="Nome comercial" defaultValue={c.tradeName} />
                  <Input name="legalName" label="Firma (nome legal)" defaultValue={c.legalName} />
                  <Input name="nif" label="NIF" defaultValue={c.nif} />
                  <Input name="email" label="Email" type="email" defaultValue={c.email} />
                  <Input name="phone" label="Telefone" defaultValue={c.phoneE164 ? formatPhone(c.phoneE164) : ""} />
                  <Input name="whatsapp" label="WhatsApp (número central)" defaultValue={c.whatsappE164 ? formatPhone(c.whatsappE164) : ""} hint="Usado nos botões Click to Chat." />
                  <Input name="instagramUrl" label="Instagram (URL)" defaultValue={c.instagramUrl} />
                  <Input name="facebookUrl" label="Facebook (URL)" defaultValue={c.facebookUrl} />
                  <Input name="privacyEmail" label="Email para privacidade" type="email" defaultValue={c.privacyEmail} />
                </div>
                <div>
                  <label className="field-label" htmlFor="c-valueProposition">Frase principal da página inicial</label>
                  <input id="c-valueProposition" name="valueProposition" defaultValue={c.valueProposition ?? ""} className="input" placeholder="Encontra a tua próxima viatura." />
                  <p className="field-hint">Só afirmações verdadeiras e verificáveis.</p>
                </div>
                <div>
                  <label className="field-label" htmlFor="c-aboutText">Texto «Sobre nós» (curto)</label>
                  <textarea id="c-aboutText" name="aboutText" defaultValue={c.aboutText ?? ""} className="input" />
                </div>
              </>
            </>
          </ActionForm>
        </section>

        <section className="space-y-6">
          <div className="panel p-5">
            <h2 className="heading text-lg">Serviços confirmados</h2>
            <p className="text-sm text-muted">Só os serviços ativos aparecem no site.</p>
            <ActionForm action={saveServicesAction} submitLabel="Guardar" className="mt-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {SERVICES.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name={s} defaultChecked={data.services[s]} className="check" /> {SERVICE_LABEL[s]}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted">Financiamento: no site é apenas um pedido de contacto. Não são publicadas mensalidades nem taxas sem condições aprovadas pelo parceiro.</p>
            </ActionForm>
          </div>
          <div className="panel p-5">
            <h2 className="heading text-lg">Regras do CRM</h2>
            <ActionForm action={saveCrmAction} submitLabel="Guardar" className="mt-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="autoAssign" defaultChecked={data.crm.autoAssign} className="check" /> Distribuir automaticamente os novos contactos
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input name="unansweredAlertMinutes" label="Alerta sem resposta (min)" type="number" defaultValue={data.crm.unansweredAlertMinutes} />
                <Input name="reservationDefaultDays" label="Reserva por omissão (dias)" type="number" defaultValue={data.crm.reservationDefaultDays} />
                <Input name="appointmentSlotMinutes" label="Duração da visita (min)" type="number" defaultValue={data.crm.appointmentSlotMinutes} />
              </div>
            </ActionForm>
          </div>
        </section>

        <section className="panel p-5 lg:col-span-2">
          <h2 className="heading text-lg">Informação legal</h2>
          <p className="text-sm text-muted">Confirma com o teu contabilista ou jurista. Os textos legais usam estes dados.</p>
          <ActionForm action={saveLegalAction} submitLabel="Guardar" className="mt-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input name="complaintsBookUrl" label="Livro de Reclamações Eletrónico (URL)" defaultValue={data.legal.complaintsBookUrl} />
              <Input name="ralEntityName" label="Entidade de resolução alternativa de litígios" defaultValue={data.legal.ralEntityName} hint="Ex.: centro de arbitragem competente para a tua zona/setor." />
              <Input name="ralEntityUrl" label="Site da entidade (URL)" defaultValue={data.legal.ralEntityUrl} />
              <Input name="ralEntityAddress" label="Morada da entidade" defaultValue={data.legal.ralEntityAddress} />
              <Input name="consentVersion" label="Versão dos textos de consentimento" defaultValue={data.legal.consentVersion} hint="Alterar obriga os visitantes a escolher de novo os cookies." />
            </div>
            <div>
              <label className="field-label" htmlFor="c-dataRetentionText">Prazos de conservação de dados</label>
              <textarea id="c-dataRetentionText" name="dataRetentionText" defaultValue={data.legal.dataRetentionText ?? ""} className="input" placeholder="Definir com o responsável. Ex.: pedidos sem venda são apagados ao fim de X meses." />
            </div>
            <div>
              <label className="field-label" htmlFor="c-creditIntermediaryText">Intermediação de crédito (se aplicável)</label>
              <textarea id="c-creditIntermediaryText" name="creditIntermediaryText" defaultValue={data.legal.creditIntermediaryText ?? ""} className="input" placeholder="Registo no Banco de Portugal, categoria, parceiros… Só preencher com dados aprovados." />
            </div>
          </ActionForm>
        </section>

        {[...data.branches, null].map((b) => (
          <section key={b?.id ?? "new"} className="panel p-5 lg:col-span-2">
            <h2 className="heading text-lg">
              {b ? b.name : "Nova instalação"} {b?.isDemo && <span className="tag tag-dark">Demonstração</span>}
            </h2>
            <ActionForm action={saveBranchAction} submitLabel={b ? "Guardar instalação" : "Criar instalação"} className="mt-3">
              <>
                <>
                  {b && <input type="hidden" name="id" value={b.id} />}
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input name="name" label="Nome" defaultValue={b?.name} />
                    <Input name="addressLine" label="Morada" defaultValue={b?.addressLine} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input name="postalCode" label="Código postal" defaultValue={b?.postalCode} />
                      <Input name="city" label="Localidade" defaultValue={b?.city} />
                    </div>
                    <Input name="phone" label="Telefone" defaultValue={b?.phoneE164 ? formatPhone(b.phoneE164) : ""} />
                    <Input name="email" label="Email" defaultValue={b?.email} />
                    <Input name="mapsUrl" label="Ligação Google Maps (opcional)" defaultValue={b?.mapsUrl} />
                    <Input name="latitude" label="Latitude" defaultValue={b?.latitude} />
                    <Input name="longitude" label="Longitude" defaultValue={b?.longitude} />
                    <label className="flex items-center gap-2 self-end pb-3 text-sm">
                      <input type="checkbox" name="isActive" defaultChecked={b ? b.isActive : true} className="check" /> Ativa
                    </label>
                  </div>
                  <fieldset>
                    <legend className="field-label">Horário (até dois períodos por dia; vazio = encerrado)</legend>
                    <div className="grid gap-2 md:grid-cols-2">
                      {WEEKDAYS.map((d) => {
                        const iv = b?.openingHours?.[d.key] ?? [];
                        return (
                          <div key={d.key} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="w-24 font-semibold">{d.label}</span>
                            {[1, 2].map((i) => (
                              <span key={i} className="flex items-center gap-1">
                                <input type="time" name={`${d.key}_${i}_open`} defaultValue={iv[i - 1]?.[0] ?? ""} className="input min-h-9 w-28 py-1" aria-label={`${d.label} abertura ${i}`} />
                                –
                                <input type="time" name={`${d.key}_${i}_close`} defaultValue={iv[i - 1]?.[1] ?? ""} className="input min-h-9 w-28 py-1" aria-label={`${d.label} fecho ${i}`} />
                              </span>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>
                </>
              </>
            </ActionForm>
            {b && (
              <ActionForm action={addClosureAction} submitLabel="Adicionar encerramento" submitClassName="btn-outline btn-sm" className="mt-4 border-t border-line pt-4">
                <input type="hidden" name="branchId" value={b.id} />
                <div className="flex flex-wrap gap-2">
                  <input type="date" name="date" className="input max-w-[12rem]" aria-label="Data de encerramento" />
                  <input name="reason" className="input max-w-xs" placeholder="Motivo (ex.: feriado)" aria-label="Motivo" />
                </div>
              </ActionForm>
            )}
          </section>
        ))}
        {data.closures.length > 0 && (
          <section className="panel p-5 lg:col-span-2">
            <h2 className="heading text-lg">Próximos encerramentos</h2>
            <ul className="mt-2 text-sm">
              {data.closures.map((cl) => (
                <li key={cl.closedOn + cl.name}>{formatDate(cl.closedOn)} · {cl.name}{cl.reason ? ` · ${cl.reason}` : ""}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
