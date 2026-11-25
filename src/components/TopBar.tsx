import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  Menu,
  ShieldCheck,
  Trash2,
  UserCheck,
} from "lucide-react";
import {
  ActiveAccessContext,
  NavigationTab,
  NotificationItem,
  TeamDoc,
} from "../types/activity";
import {
  ReminderItem,
  formatTanggalID,
  getRoleDisplayLabel,
} from "../utils/activityHelpers";

interface TopBarProps {
  activeTab: NavigationTab;
  access: ActiveAccessContext;
  teams: TeamDoc[];
  onChangeViewTeamFilter: (teamId: string) => void;
  onOpenAdminPanel: () => void;
  reminders: ReminderItem[];
  notifications: NotificationItem[];
  onMarkNotificationRead: (notifId: string) => void;
  onDeleteNotification: (notifId: string) => void;
  onOpenMobileMenu: () => void;
  onSelectReminderActivity: (activityId: string) => void;
}

const TAB_TITLES: Record<NavigationTab, string> = {
  dashboard: "Dashboard Eksekutif",
  rencana: "Rencana Kegiatan",
  monitoring: "Monitoring Kegiatan",
  "ai-planner": "AI Activity Planner",
};

export function TopBar({
  activeTab,
  access,
  teams,
  onChangeViewTeamFilter,
  onOpenAdminPanel,
  reminders,
  notifications,
  onMarkNotificationRead,
  onDeleteNotification,
  onOpenMobileMenu,
  onSelectReminderActivity,
}: TopBarProps) {
  const [reminderOpen, setReminderOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const reminderRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        reminderRef.current &&
        !reminderRef.current.contains(e.target as Node)
      ) {
        setReminderOpen(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const unreadNotifications = notifications.filter((n) => !n.dibaca);
  const totalAlertCount =
    unreadNotifications.length > 0
      ? unreadNotifications.length
      : reminders.length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
      {/* Left: Mobile Trigger & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden focus-visible:outline-2 focus-visible:outline-blue-600"
          aria-label="Buka menu navigasi"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="hidden sm:inline text-slate-400 font-medium whitespace-nowrap">
            PusKI
          </span>
          <span className="hidden sm:inline text-slate-300" aria-hidden="true">
            /
          </span>
          <h1 className="text-base sm:text-lg font-semibold tracking-tight text-[#0B1F3A] truncate">
            {TAB_TITLES[activeTab]}
          </h1>
        </div>
      </div>

      {/* Right: Reminders / Firestore Notifications & Access Context */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Notification Popover */}
        <div className="relative" ref={reminderRef}>
          <button
            type="button"
            onClick={() => {
              setReminderOpen((prev) => !prev);
              setProfileOpen(false);
            }}
            className={`relative inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600 ${
              totalAlertCount > 0
                ? "border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100/70"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            aria-expanded={reminderOpen}
            aria-label={`Pengingat kegiatan (${totalAlertCount})`}
          >
            <Bell className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Pengingat</span>
            <span
              className={`tabular-nums font-mono text-xs font-semibold ${
                totalAlertCount > 0 ? "text-amber-800" : "text-slate-500"
              }`}
            >
              ({totalAlertCount})
            </span>
          </button>

          {reminderOpen && (
            <div className="absolute right-0 mt-2 w-[320px] sm:w-[390px] rounded-xl border border-slate-200 bg-white shadow-lg z-40">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Notifikasi Pengingat Kegiatan
                  </p>
                  <p className="text-xs text-slate-500">
                    Tersimpan pada sub-koleksi notifikasi akun Anda
                  </p>
                </div>
                <span className="font-mono text-xs font-semibold text-blue-700 tabular-nums">
                  {notifications.length > 0
                    ? `${unreadNotifications.length} belum dibaca`
                    : `${reminders.length} item`}
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                        notif.dibaca ? "bg-white" : "bg-blue-50/40"
                      }`}
                    >
                      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[#1D4ED8]" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-[#0B1F3A]">
                            {notif.judul}
                          </p>
                          <span className="font-mono text-[10px] text-slate-400">
                            {formatTanggalID(notif.tanggalPengingat)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!notif.dibaca) {
                              onMarkNotificationRead(notif.id);
                            }
                            setReminderOpen(false);
                            onSelectReminderActivity(notif.activityId);
                          }}
                          className="text-left text-xs text-slate-700 hover:text-[#1D4ED8] line-clamp-2"
                        >
                          {notif.pesan}
                        </button>
                        <div className="flex items-center gap-3 pt-0.5">
                          {!notif.dibaca && (
                            <button
                              type="button"
                              onClick={() => onMarkNotificationRead(notif.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1D4ED8] hover:underline"
                            >
                              <Check className="h-3 w-3" />
                              <span>Tandai dibaca</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteNotification(notif.id)}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : reminders.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      Tidak ada pengingat mendesak
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Seluruh kegiatan terjadwal berada di luar jendela pengingat saat ini.
                    </p>
                  </div>
                ) : (
                  reminders.map((item) => (
                    <button
                      key={item.activity.id}
                      type="button"
                      onClick={() => {
                        setReminderOpen(false);
                        onSelectReminderActivity(item.activity.id);
                      }}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      <div className="mt-0.5 shrink-0">
                        {item.type === "overdue" ? (
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        ) : item.type === "approaching" ? (
                          <Clock className="h-4 w-4 text-amber-600" />
                        ) : (
                          <CalendarClock className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p
                          className={`text-xs font-semibold ${
                            item.type === "overdue"
                              ? "text-red-700"
                              : item.type === "approaching"
                              ? "text-amber-700"
                              : "text-blue-700"
                          }`}
                        >
                          {item.title}
                        </p>
                        <p className="text-xs font-medium text-slate-900 line-clamp-2">
                          {item.activity.namaKegiatan}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {item.activity.timPelaksana} ·{" "}
                          {formatTanggalID(item.activity.tanggalPelaksanaan)}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Role & Team Filter Popover */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => {
              setProfileOpen((prev) => !prev);
              setReminderOpen(false);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs sm:text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-blue-600"
            aria-expanded={profileOpen}
            aria-label="Informasi peran dan filter tim"
          >
            <UserCheck className="h-4 w-4 text-[#1D4ED8] shrink-0" aria-hidden="true" />
            <span className="max-w-[140px] sm:max-w-[200px] truncate">
              {getRoleDisplayLabel(access.role)} ·{" "}
              {access.canViewAllTeams
                ? access.viewTeamFilter === "ALL"
                  ? "Semua Tim"
                  : teams.find((t) => t.id === access.viewTeamFilter)?.nama_tim ??
                    access.viewTeamFilter
                : access.teamName}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg z-40">
              <div className="border-b border-slate-100 px-4 py-3 space-y-0.5">
                <p className="text-xs font-semibold text-slate-900">
                  {access.nama}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {access.email}
                </p>
                <p className="text-[11px] font-medium text-[#1D4ED8]">
                  Role: {getRoleDisplayLabel(access.role)} ({access.jabatan})
                </p>
              </div>

              {access.canViewAllTeams ? (
                <div className="p-2 space-y-1">
                  <p className="px-2 py-1 text-[11px] font-semibold text-slate-500">
                    Filter Cakupan Tim
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeViewTeamFilter("ALL");
                      setProfileOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium ${
                      access.viewTeamFilter === "ALL"
                        ? "bg-blue-50 text-[#0B1F3A] font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>Seluruh Tim PusKI</span>
                    {access.viewTeamFilter === "ALL" && (
                      <span className="text-[#1D4ED8]">Aktif</span>
                    )}
                  </button>
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onChangeViewTeamFilter(t.id);
                        setProfileOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium ${
                        access.viewTeamFilter === t.id
                          ? "bg-blue-50 text-[#0B1F3A] font-semibold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{t.nama_tim}</span>
                      {access.viewTeamFilter === t.id && (
                        <span className="text-[#1D4ED8]">Aktif</span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 text-xs text-slate-600">
                  Akses Anda terikat pada{" "}
                  <span className="font-semibold text-slate-900">
                    {access.teamName}
                  </span>
                  . Hubungi Admin bila memerlukan perubahan tim atau role.
                </div>
              )}

              {access.canManageAdmin && (
                <div className="border-t border-slate-100 p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenAdminPanel();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B1F3A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#13325C]"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Kelola Tim & Pengguna</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
