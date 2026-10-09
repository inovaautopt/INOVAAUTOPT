import { requireStaff, withStaff } from "@/server/auth";
import { PageHeader } from "@/components/admin/ui";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { saveVehicleAction } from "../actions";
import type { FeatureGroup } from "@/lib/domain";

export default async function NewVehicle() {
  await requireStaff(["admin", "stock_manager"]);
  const { branches, features } = await withStaff(undefined, async (tx) => ({
    branches: (await tx`select id, name from app.branches where is_active order by name`) as unknown as { id: string; name: string }[],
    features: (await tx`select id, name, feature_group as "group" from app.features order by feature_group, name`) as unknown as { id: string; name: string; group: FeatureGroup }[],
  }));
  return (
    <>
      <PageHeader title="Nova viatura" description="Começa como rascunho. Depois de guardares, carrega as fotografias e publica." />
      <VehicleForm action={saveVehicleAction} values={{ status: "draft", vatRegime: "unknown" }} branches={branches} features={features} canSeePrivate />
    </>
  );
}
