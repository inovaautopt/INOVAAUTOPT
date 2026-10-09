import Link from "next/link";
import { cn } from "@/lib/cn";
import { LEAD_STATUS_LABEL, VEHICLE_STATUS_LABEL, type LeadStatus, type VehicleStatus } from "@/lib/domain";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="heading text-2xl md:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-[70ch] text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const VSTATUS: Record<VehicleStatus, string> = { draft: "", available: "tag-ok", reserved: "tag-warn", sold: "tag-dark", archived: "" };
export function VehicleStatusTag({ status }: { status: VehicleStatus }) {
  return <span className={cn("tag", VSTATUS[status])}>{VEHICLE_STATUS_LABEL[status]}</span>;
}

const LSTATUS: Record<LeadStatus, string> = { new: "tag-brand", assigned: "tag-brand", contacted: "", visit_scheduled: "tag-warn", proposal_sent: "tag-warn", won: "tag-ok", lost: "tag-danger", archived: "" };
export function LeadStatusTag({ status }: { status: LeadStatus }) {
  return <span className={cn("tag", LSTATUS[status])}>{LEAD_STATUS_LABEL[status]}</span>;
}

export function StatCard({ label, value, href, tone }: { label: string; value: number | string; href?: string; tone?: "warn" | "danger" }) {
  const inner = (
    <div className={cn("panel h-full p-4", tone === "warn" && "border-warn/40 bg-warn-soft", tone === "danger" && "border-danger/40 bg-danger-soft")}>
      <p className="text-sm text-muted">{label}</p>
      <p className="heading mt-1 text-3xl num">{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-90">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="panel p-6 text-sm text-muted">{children}</div>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "ok"; children: React.ReactNode }) {
  const cls = { info: "bg-brand-soft text-brand-ink", warn: "bg-warn-soft text-warn", danger: "bg-danger-soft text-danger", ok: "bg-ok-soft text-ok" }[tone];
  return <div className={cn("rounded-[var(--radius-sm)] p-3 text-sm", cls)}>{children}</div>;
}
