import {
  Activity as ActivityIcon,
  CalendarPlus,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { ActiveAccessContext, NavigationTab } from "../types/activity";
import { getRoleDisplayLabel } from "../utils/activityHelpers";

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  access: ActiveAccessContext;
  userDisplayName: string;
  userEmail: string | null;
  onOpenAdminPanel: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}

const NAV_ITEMS: Array<{
  id: NavigationTab;
  label: string;
  Icon: typeof LayoutDashboard;
}> = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "rencana", label: "Rencana Kegiatan", Icon: CalendarPlus },
  { id: "monitoring", label: "Monitoring Kegiatan", Icon: ActivityIcon },
  { id: "ai-planner", label: "AI Activity Planner", Icon: Sparkles },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  access,
  userDisplayName,
  userEmail,
  onOpenAdminPanel,
  mobileOpen,
  onCloseMobile,
  onLogout,
}: SidebarProps) {
  const handleNavClick = (tab: NavigationTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#0B1F3A] text-white select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1D4ED8] text-white font-bold text-sm tracking-tight">
            PK
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-white truncate">
              PusKI Dashboard
            </p>
            <p className="text-[11px] text-slate-300 truncate">
              Kemkomdigi · Kelembagaan Int.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden focus-visible:outline-2 focus-visible:outline-white"
          aria-label="Tutup menu navigasi"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Menu Utama">
        <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400">
          Navigasi Utama
        </p>
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleNavClick(id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-400 ${
                isActive
                  ? "bg-[#1D4ED8] text-white"
                  : "text-slate-300 hover:bg-white/8 hover:text-white"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Active Account, Role & Actions */}
      <div className="border-t border-white/10 px-4 py-4 space-y-3">
        <div className="space-y-0.5 pb-2 border-b border-white/10">
          <p className="text-[11px] font-medium text-slate-400">
            Akun Google
          </p>
          <p className="text-xs font-semibold text-white truncate">
            {userDisplayName}
          </p>
          {userEmail && (
            <p className="text-[11px] text-slate-300 truncate">{userEmail}</p>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-medium text-slate-400">
            Hak Akses Firestore
          </p>
          <p className="text-xs font-semibold text-white truncate">
            {getRoleDisplayLabel(access.role)} · {access.jabatan}
          </p>
          <p className="text-[11px] leading-relaxed text-slate-300">
            {access.canViewAllTeams
              ? "Cakupan: Seluruh Tim PusKI"
              : `Cakupan: Khusus ${access.teamName}`}
          </p>
        </div>

        <div className="space-y-2 pt-1">
          {access.canManageAdmin && (
            <button
              type="button"
              onClick={() => {
                onOpenAdminPanel();
                onCloseMobile();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-400/30 bg-blue-500/15 px-3 py-2 text-xs font-semibold text-blue-100 transition-colors hover:bg-blue-500/25 hover:text-white whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-400"
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Kelola Tim & Pengguna</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              onLogout();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition-colors hover:bg-red-500/20 hover:text-white whitespace-nowrap focus-visible:outline-2 focus-visible:outline-red-400"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block lg:w-[260px] lg:shrink-0 border-r border-slate-200">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-[272px] max-w-[85vw] h-full shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
