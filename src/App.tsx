import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  AlertCircle,
  CheckCircle2,
  DatabaseBackup,
  Loader2,
} from "lucide-react";
import { auth } from "./firebase";
import { AIPlannerView } from "./components/AIPlannerView";
import { ActivityFormModal } from "./components/ActivityFormModal";
import { AdminManagementModal } from "./components/AdminManagementModal";
import { DashboardView } from "./components/DashboardView";
import { ExcelImportModal } from "./components/ExcelImportModal";
import { LoginView } from "./components/LoginView";
import { MonitoringKegiatanView } from "./components/MonitoringKegiatanView";
import { MonitoringUpdateModal } from "./components/MonitoringUpdateModal";
import { RencanaKegiatanView } from "./components/RencanaKegiatanView";
import { RoleSelectionView } from "./components/RoleSelectionView";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import {
  checkIsProvisionedAdmin,
  createActivityInFirestore,
  createActivityTask,
  DEFAULT_TEAMS,
  deleteActivityInFirestore,
  deleteNotificationDoc,
  fetchUserProfile,
  getLegacyLocalOfficialActivities,
  importExcelActivitiesToFirestore,
  markNotificationRead,
  migrateLegacyLocalActivitiesToFirestore,
  resolveTeamDisplayName,
  saveUserRoleSelection,
  seedDefaultTeamsIfMissing,
  subscribeActivities,
  subscribeAllUsers,
  subscribeTeams,
  subscribeUserNotifications,
  subscribeUserProfile,
  syncActivityReminderNotification,
  updateActivityMonitoringInFirestore,
  updateActivityPlanInFirestore,
  updateActivityStatusInFirestore,
} from "./services/firestoreService";
import {
  AIPlanResponse,
  ActiveAccessContext,
  Activity,
  ActivityFormValues,
  ActivityStatus,
  NavigationTab,
  NotificationItem,
  TeamDoc,
  UserProfileDoc,
  UserRole,
} from "./types/activity";
import {
  canManageActivity,
  getActiveReminders,
  getVisibleActivities,
} from "./utils/activityHelpers";
import { ParsedExcelRow } from "./utils/excelImport";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Firestore synced states
  const [userProfile, setUserProfile] = useState<UserProfileDoc | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [isProvisionedAdmin, setIsProvisionedAdmin] = useState(false);
  const [teams, setTeams] = useState<TeamDoc[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfileDoc[]>([]);
  const [firestoreActivities, setFirestoreActivities] = useState<Activity[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // UI states
  const [activeTab, setActiveTab] = useState<NavigationTab>("dashboard");
  const [viewTeamFilter, setViewTeamFilter] = useState<string>("ALL");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [aiDraftPrefill, setAiDraftPrefill] =
    useState<Partial<ActivityFormValues> | null>(null);
  const [pendingAiStages, setPendingAiStages] = useState<
    AIPlanResponse["preparationStages"] | null
  >(null);

  const [monitoringTargetId, setMonitoringTargetId] = useState<string | null>(
    null
  );
  const [highlightedActivityId, setHighlightedActivityId] = useState<
    string | null
  >(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Legacy local migration prompt (non-demo records only)
  const [legacyLocalCount, setLegacyLocalCount] = useState<number>(0);
  const [migratingLegacy, setMigratingLegacy] = useState(false);

  // Admin Excel import modal state
  const [excelModalOpen, setExcelModalOpen] = useState(false);

  const seededTeamsRef = useRef(false);
  const syncedNotifKeysRef = useRef<Set<string>>(new Set());

  // 1. Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      setProfileLoaded(false);
      if (!firebaseUser) {
        setUserProfile(null);
        setIsProvisionedAdmin(false);
        setFirestoreActivities([]);
        setNotifications([]);
        setAllUsers([]);
        seededTeamsRef.current = false;
        syncedNotifKeysRef.current.clear();
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch & subscribe to current user's /users/{uid} profile
  useEffect(() => {
    if (!user) return;
    let active = true;
    setProfileLoaded(false);

    Promise.all([fetchUserProfile(user), checkIsProvisionedAdmin(user)])
      .then(([initialProfile, provisionedAdmin]) => {
        if (active) {
          setUserProfile(initialProfile);
          setIsProvisionedAdmin(provisionedAdmin);
          setProfileLoaded(true);
        }
      })
      .catch(() => {
        if (active) {
          setIsProvisionedAdmin(false);
          setProfileLoaded(true);
        }
      });

    const unsubProfile = subscribeUserProfile(user.uid, (profile) => {
      if (active && profile) {
        setUserProfile(profile);
        setProfileLoaded(true);
      }
    });

    return () => {
      active = false;
      unsubProfile();
    };
  }, [user]);

  // 3. Subscribe to /teams and bootstrap default Tim 1..3 if Firestore is empty
  useEffect(() => {
    if (!user) return;
    const unsubTeams = subscribeTeams((teamList) => {
      setTeams(teamList);
      if (
        userProfile?.role_selected === true &&
        !seededTeamsRef.current &&
        teamList.length < DEFAULT_TEAMS.length
      ) {
        seededTeamsRef.current = true;
        seedDefaultTeamsIfMissing(teamList).catch(() => {
          seededTeamsRef.current = false;
        });
      }
    });
    return () => unsubTeams();
  }, [user, userProfile?.role_selected]);

  // 4. Subscribe to /users list only when admin
  useEffect(() => {
    if (
      !user ||
      userProfile?.role_selected !== true ||
      userProfile.role !== "admin"
    ) {
      setAllUsers([]);
      return;
    }
    const unsubUsers = subscribeAllUsers(setAllUsers);
    return () => unsubUsers();
  }, [user, userProfile?.role, userProfile?.role_selected]);

  // 5. Subscribe to /activities scoped by Firestore role & team_id
  useEffect(() => {
    if (!user || !userProfile || userProfile.role_selected !== true) return;
    const unsubActivities = subscribeActivities(
      userProfile,
      teams,
      setFirestoreActivities
    );
    return () => unsubActivities();
  }, [user, userProfile, teams]);

  // 6. Subscribe to /users/{uid}/notifications
  useEffect(() => {
    if (!user || !userProfile || userProfile.role_selected !== true) return;
    const unsubNotifs = subscribeUserNotifications(user.uid, setNotifications);
    return () => unsubNotifs();
  }, [user, userProfile]);

  // Check if legacy non-demo localStorage activities exist
  useEffect(() => {
    if (!user || !userProfile || userProfile.role_selected !== true) return;
    const legacy = getLegacyLocalOfficialActivities();
    setLegacyLocalCount(legacy.length);
  }, [user, userProfile]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const effectiveTeams: TeamDoc[] = useMemo(() => {
    if (teams.length > 0) return teams;
    return DEFAULT_TEAMS.map((t) => ({ ...t }));
  }, [teams]);

  const access: ActiveAccessContext = useMemo(() => {
    const role = userProfile?.role ?? "pegawai";
    const teamId = userProfile?.team_id ?? "tim_1";
    const canViewAllTeams = role === "admin" || role === "pimpinan";
    return {
      uid: user?.uid ?? "",
      nama:
        userProfile?.nama ||
        user?.displayName?.trim() ||
        user?.email?.trim() ||
        "Pengguna PusKI",
      email: userProfile?.email || user?.email || "",
      role,
      teamId,
      teamName: resolveTeamDisplayName(teamId, effectiveTeams),
      jabatan:
        userProfile?.jabatan ||
        (role === "admin"
          ? "Administrator"
          : role === "pimpinan"
          ? "Pimpinan PusKI"
          : "Pegawai"),
      viewTeamFilter: canViewAllTeams ? viewTeamFilter : teamId,
      canViewAllTeams,
      canManageActivities: role === "admin" || role === "pegawai",
      canManageAdmin: role === "admin",
    };
  }, [user, userProfile, effectiveTeams, viewTeamFilter]);

  const visibleActivities = useMemo(
    () => getVisibleActivities(firestoreActivities, access),
    [firestoreActivities, access]
  );

  const reminders = useMemo(
    () => getActiveReminders(visibleActivities),
    [visibleActivities]
  );

  // Sync due reminders for official Firestore activities into /users/{uid}/notifications
  useEffect(() => {
    if (
      !user ||
      !userProfile ||
      userProfile.role_selected !== true ||
      firestoreActivities.length === 0
    ) {
      return;
    }
    const officialReminders = getActiveReminders(firestoreActivities);
    for (const rem of officialReminders) {
      const syncKey = `${user.uid}_${rem.activity.id}`;
      if (syncedNotifKeysRef.current.has(syncKey)) continue;
      syncedNotifKeysRef.current.add(syncKey);

      syncActivityReminderNotification(user.uid, {
        activityId: rem.activity.id,
        judul: rem.title,
        pesan: `${rem.activity.namaKegiatan} (${rem.detail})`,
        tanggalPengingat:
          rem.activity.tanggalPengingat || rem.activity.tanggalPelaksanaan,
      }).catch(() => {
        syncedNotifKeysRef.current.delete(syncKey);
      });
    }
  }, [user, userProfile, firestoreActivities]);

  const monitoringTarget = useMemo(() => {
    if (!monitoringTargetId) return null;
    return (
      firestoreActivities.find((a) => a.id === monitoringTargetId) ?? null
    );
  }, [monitoringTargetId, firestoreActivities]);

  const handleSaveActivity = async (
    values: ActivityFormValues,
    existingId?: string
  ) => {
    if (!user) return;

    if (existingId) {
      await updateActivityPlanInFirestore(
        existingId,
        values,
        access.role === "admin"
      );
      setToastMessage("Perubahan rencana kegiatan disimpan ke Cloud Firestore.");
    } else {
      const newActivityId = await createActivityInFirestore(values, user.uid);
      if (pendingAiStages && pendingAiStages.length > 0) {
        for (const stage of pendingAiStages) {
          await createActivityTask(newActivityId, {
            namaTugas: `${stage.phase}: ${stage.title}`,
            pic: values.pic,
            deadline: values.tanggalPelaksanaan,
            targetOutput: stage.description.slice(0, 380),
            status: "Belum Dimulai",
            progres: 0,
          });
        }
      }
      setToastMessage(
        "Kegiatan baru berhasil disimpan ke Cloud Firestore."
      );
    }

    setFormModalOpen(false);
    setEditingActivity(null);
    setAiDraftPrefill(null);
    setPendingAiStages(null);
  };

  const handleDeleteActivity = async (activityId: string) => {
    await deleteActivityInFirestore(activityId);
    setToastMessage("Kegiatan berhasil dihapus dari Cloud Firestore.");
  };

  const handleSaveMonitoring = async (
    activityId: string,
    updates: {
      status: ActivityStatus;
      progres: number;
      hasilKegiatan: string;
    }
  ) => {
    await updateActivityMonitoringInFirestore(activityId, updates);
    setMonitoringTargetId(null);
    setToastMessage(
      "Status dan progres monitoring disimpan ke Cloud Firestore."
    );
  };

  const handleInspectActivity = (activityId: string) => {
    setHighlightedActivityId(activityId);
    setActiveTab("monitoring");
  };

  const handleUseAIPlan = (
    draft: Partial<ActivityFormValues>,
    stages?: AIPlanResponse["preparationStages"]
  ) => {
    setEditingActivity(null);
    setAiDraftPrefill(draft);
    setPendingAiStages(stages ?? null);
    setActiveTab("rencana");
    setFormModalOpen(true);
  };

  const handleMigrateLegacyLocal = async () => {
    if (!user) return;
    setMigratingLegacy(true);
    try {
      const count = await migrateLegacyLocalActivitiesToFirestore(
        user.uid,
        access.teamId,
        access.role === "admin"
      );
      setLegacyLocalCount(0);
      setToastMessage(
        `${count} kegiatan lokal berhasil dimigrasikan ke Cloud Firestore.`
      );
    } finally {
      setMigratingLegacy(false);
    }
  };

  const handleSaveExcelRows = async (validRows: ParsedExcelRow[]) => {
    if (!user || !access.canManageAdmin) {
      throw new Error("Hanya Admin yang dapat melakukan import Excel.");
    }
    const result = await importExcelActivitiesToFirestore(
      user.uid,
      validRows,
      effectiveTeams
    );
    if (result.failedCount > 0) {
      setToastMessage(
        `Import Excel selesai: ${result.savedCount} disimpan, ${result.failedCount} gagal.`
      );
    } else if (result.savedCount > 0) {
      setToastMessage(
        `Import Excel berhasil: ${result.savedCount} kegiatan disimpan ke Cloud Firestore.`
      );
    } else {
      setToastMessage(
        `Import selesai: semua data valid sudah tersedia di Cloud Firestore.`
      );
    }
    return result;
  };

  const handleStatusChange = async (
    activityId: string,
    newStatus: ActivityStatus
  ) => {
    await updateActivityStatusInFirestore(activityId, newStatus);
    setToastMessage(
      `Status kegiatan diperbarui menjadi "${newStatus}" di Cloud Firestore.`
    );
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab("dashboard");
      setMobileMenuOpen(false);
      setHighlightedActivityId(null);
      setAdminModalOpen(false);
      setExcelModalOpen(false);
    } catch {
      setToastMessage("Gagal keluar dari sesi akun. Silakan coba kembali.");
    }
  };

  const handleSaveRoleSelection = async (selection: {
    role: UserRole;
    team_id: string;
    jabatan: string;
  }) => {
    if (!user) return;
    const saved = await saveUserRoleSelection(user, selection);
    setUserProfile(saved);
    setProfileLoaded(true);
    setToastMessage("Role akun berhasil disimpan ke database.");
  };

  if (authLoading || (user && !profileLoaded)) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <Loader2
          className="h-6 w-6 animate-spin text-[#1D4ED8]"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-slate-600">
          Memuat sesi & data Cloud Firestore...
        </p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  if (!userProfile || userProfile.role_selected !== true) {
    return (
      <RoleSelectionView
        user={user}
        existingProfile={userProfile}
        isProvisionedAdmin={isProvisionedAdmin}
        teams={effectiveTeams}
        onSaveRole={handleSaveRoleSelection}
        onLogout={handleLogout}
      />
    );
  }

  const userDisplayName = access.nama;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        access={access}
        userDisplayName={userDisplayName}
        userEmail={user.email}
        onOpenAdminPanel={() => setAdminModalOpen(true)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onLogout={handleLogout}
      />

      <div className="flex flex-1 flex-col min-w-0">
        <TopBar
          activeTab={activeTab}
          access={access}
          teams={effectiveTeams}
          onChangeViewTeamFilter={(teamId) => {
            setViewTeamFilter(teamId);
            setHighlightedActivityId(null);
          }}
          onOpenAdminPanel={() => setAdminModalOpen(true)}
          reminders={reminders}
          notifications={notifications}
          onMarkNotificationRead={(notifId) =>
            markNotificationRead(user.uid, notifId)
          }
          onDeleteNotification={(notifId) =>
            deleteNotificationDoc(user.uid, notifId)
          }
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectReminderActivity={handleInspectActivity}
        />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-[1440px] w-full mx-auto space-y-5">
          {/* Non-destructive Legacy LocalStorage Migration Banner */}
          {legacyLocalCount > 0 &&
            access.canManageActivities && (
              <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2.5">
                  <DatabaseBackup className="mt-0.5 h-4 w-4 shrink-0 text-[#1D4ED8]" />
                  <p className="text-xs sm:text-sm text-slate-800">
                    Ditemukan <strong>{legacyLocalCount}</strong> data kegiatan lokal sebelumnya. Pindahkan ke Cloud Firestore agar tersimpan terpusat lintas perangkat.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={migratingLegacy}
                  onClick={handleMigrateLegacyLocal}
                  className="self-start sm:self-center rounded-lg bg-[#1D4ED8] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60 whitespace-nowrap"
                >
                  {migratingLegacy
                    ? "Memindahkan..."
                    : "Migrasikan ke Cloud Firestore"}
                </button>
              </div>
            )}

          {activeTab === "dashboard" && (
            <DashboardView
              activities={visibleActivities}
              access={access}
              teams={effectiveTeams}
              userDisplayName={userDisplayName}
              reminders={reminders}
              onNavigate={setActiveTab}
              onInspectActivity={handleInspectActivity}
            />
          )}

          {activeTab === "rencana" && (
            <RencanaKegiatanView
              activities={visibleActivities}
              access={access}
              teams={effectiveTeams}
              onOpenExcelImport={() => setExcelModalOpen(true)}
              onStatusChange={handleStatusChange}
              onAddClick={() => {
                setEditingActivity(null);
                setAiDraftPrefill(null);
                setPendingAiStages(null);
                setFormModalOpen(true);
              }}
              onEditClick={(act) => {
                setEditingActivity(act);
                setAiDraftPrefill(null);
                setPendingAiStages(null);
                setFormModalOpen(true);
              }}
              onDeleteConfirm={handleDeleteActivity}
            />
          )}

          {activeTab === "monitoring" && (
            <MonitoringKegiatanView
              activities={visibleActivities}
              access={access}
              teams={effectiveTeams}
              highlightedActivityId={highlightedActivityId}
              onClearHighlight={() => setHighlightedActivityId(null)}
              onUpdateClick={(act) => setMonitoringTargetId(act.id)}
              onStatusChange={handleStatusChange}
            />
          )}

          {activeTab === "ai-planner" && (
            <AIPlannerView
              access={access}
              teams={effectiveTeams}
              onUseAsActivityPlan={handleUseAIPlan}
            />
          )}
        </main>
      </div>

      {/* Add / Edit Rencana Kegiatan Modal */}
      <ActivityFormModal
        open={formModalOpen}
        editingActivity={editingActivity}
        prefillValues={aiDraftPrefill}
        access={access}
        teams={effectiveTeams}
        onClose={() => {
          setFormModalOpen(false);
          setEditingActivity(null);
          setAiDraftPrefill(null);
          setPendingAiStages(null);
        }}
        onSave={handleSaveActivity}
      />

      {/* Update Monitoring & Tasks Sub-collection Modal */}
      <MonitoringUpdateModal
        activity={monitoringTarget}
        canEdit={
          monitoringTarget ? canManageActivity(monitoringTarget, access) : false
        }
        onClose={() => setMonitoringTargetId(null)}
        onSave={handleSaveMonitoring}
      />

      {/* Admin Excel Import Modal */}
      {access.canManageAdmin && (
        <ExcelImportModal
          open={excelModalOpen}
          teams={effectiveTeams}
          existingActivities={firestoreActivities}
          onClose={() => setExcelModalOpen(false)}
          onSaveValidRows={handleSaveExcelRows}
        />
      )}

      {/* Admin Teams & Users Management Modal */}
      {access.canManageAdmin && (
        <AdminManagementModal
          open={adminModalOpen}
          currentUid={user.uid}
          teams={effectiveTeams}
          users={allUsers}
          onClose={() => setAdminModalOpen(false)}
          onNotify={(msg) => setToastMessage(msg)}
        />
      )}

      {/* Subtle Action Toast */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-[#0B1F3A] px-4 py-3 text-xs sm:text-sm font-medium text-white shadow-lg"
        >
          {toastMessage.toLowerCase().includes("gagal") ? (
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          )}
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
