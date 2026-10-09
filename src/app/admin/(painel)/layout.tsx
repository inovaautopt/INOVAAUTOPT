import { requireStaff } from "@/server/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { STAFF_ROLE_LABEL } from "@/lib/domain";
import { logoutAction } from "../auth-actions";
import { isProduction } from "@/lib/env";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStaff();
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[15rem_1fr]">
      <AdminNav role={s.profile.role} name={s.profile.fullName} roleLabel={STAFF_ROLE_LABEL[s.profile.role]} logout={logoutAction} />
      <div className="min-w-0">
        {!isProduction() && <div className="bg-plate-yellow px-4 py-1 text-center text-xs font-semibold">Ambiente de testes</div>}
        <main className="mx-auto max-w-[80rem] px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
