import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  XCircle,
} from "lucide-react";
import { ActivityStatus } from "../types/activity";

interface StatusIndicatorProps {
  status: ActivityStatus;
  compact?: boolean;
}

export function StatusIndicator({ status, compact = false }: StatusIndicatorProps) {
  const config: Record<
    ActivityStatus,
    {
      badgeClasses: string;
      Icon: typeof CheckCircle2;
      label: string;
    }
  > = {
    Selesai: {
      badgeClasses: "border-emerald-200 bg-emerald-50 text-emerald-800",
      Icon: CheckCircle2,
      label: "Selesai",
    },
    "Sedang Berjalan": {
      badgeClasses: "border-blue-200 bg-blue-50 text-blue-800",
      Icon: Clock3,
      label: "Sedang Berjalan",
    },
    "Belum Dimulai": {
      badgeClasses: "border-slate-200 bg-slate-100 text-slate-700",
      Icon: CircleDashed,
      label: "Belum Dimulai",
    },
    Terlambat: {
      badgeClasses: "border-red-200 bg-red-50 text-red-800",
      Icon: AlertTriangle,
      label: "Terlambat",
    },
    Dibatalkan: {
      badgeClasses: "border-zinc-200 bg-zinc-100 text-zinc-500",
      Icon: XCircle,
      label: "Dibatalkan",
    },
  };

  const current = config[status] ?? config["Belum Dimulai"];
  const Icon = current.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-semibold whitespace-nowrap ${
        compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${current.badgeClasses}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{current.label}</span>
    </span>
  );
}
