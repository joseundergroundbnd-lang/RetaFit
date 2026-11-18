import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Check,
  Cloud,
  CloudOff,
  Home,
  Pill,
  PlusCircle,
  Settings,
} from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'motion/react';
import { DailyLog, MainTab, MedicationLog, UserProfile } from './types/retafit';
import {
  buildInitialData,
  DEFAULT_PROFILE,
  ParsedImportResult,
} from './data/initialData';
import {
  batchInsertMedicationLogsCloud,
  batchUpsertDailyLogsCloud,
  clearAllUserDataCloud,
  deleteDailyLogCloud,
  deleteMedicationLogCloud,
  fetchUserCloudData,
  isSupabaseConfigured,
  supabase,
  upsertDailyLogCloud,
  upsertMedicationLogCloud,
  upsertUserProfileCloud,
} from './lib/supabase';
import { RetafitLogo } from './components/RetafitLogo';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { DashboardView } from './components/DashboardView';
import { DailyLogView } from './components/DailyLogView';
import { ChartsView } from './components/ChartsView';
import { HistoryView } from './components/HistoryView';
import { SettingsBackupModal } from './components/SettingsBackupModal';
import { AuthScreen } from './components/AuthScreen';

export default function App() {
  const initialLocal = React.useMemo(() => buildInitialData(), []);

  const [activeTab, setActiveTab] = useState<MainTab>('inicio');
  const [registroSubTab, setRegistroSubTab] = useState<'diario' | 'medicacion'>('diario');
  const [selectedDate, setSelectedDate] = useState<string>('2026-11-17');

  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>(
    isSupabaseConfigured ? [] : initialLocal.dailyLogs
  );
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>(
    isSupabaseConfigured ? [] : initialLocal.medicationLogs
  );

  // Auth & Sync State
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState<boolean>(!isSupabaseConfigured);
  const [loadingCloud, setLoadingCloud] = useState<boolean>(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [lastSavedText, setLastSavedText] = useState<string | null>(null);
  const [offerInitialCloudSeed, setOfferInitialCloudSeed] = useState<boolean>(false);

  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [dismissSetupBanner, setDismissSetupBanner] = useState<boolean>(false);

  const markSaved = useCallback((customLabel?: string) => {
    const time = new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLastSavedText(customLabel ? `${customLabel} · ${time}` : `Guardado · ${time}`);
    setTimeout(() => {
      setLastSavedText((prev) => (prev && prev.includes(time) ? null : prev));
    }, 4000);
  }, []);

  const loadCloudData = useCallback(async (currentUser: User) => {
    setLoadingCloud(true);
    setCloudError(null);
    try {
      const data = await fetchUserCloudData(currentUser);
      setProfile(data.profile);
      setDailyLogs(data.dailyLogs);
      setMedicationLogs(data.medicationLogs);
      setOfferInitialCloudSeed(data.dailyLogs.length === 0 && data.medicationLogs.length === 0);
      if (data.dailyLogs.length > 0) {
        const latest = [...data.dailyLogs].sort((a, b) => a.date.localeCompare(b.date)).pop();
        if (latest) setSelectedDate(latest.date);
      }
    } catch (err) {
      setCloudError(
        err instanceof Error ? err.message : 'No se pudieron recuperar los datos de Supabase.'
      );
    } finally {
      setLoadingCloud(false);
    }
  }, []);

  const loadedUserIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const sessionUser = data.session?.user ?? null;
        setUser(sessionUser);
        setAuthChecked(true);
        if (sessionUser && loadedUserIdRef.current !== sessionUser.id) {
          loadedUserIdRef.current = sessionUser.id;
          loadCloudData(sessionUser);
        }
      })
      .catch(() => {
        if (mounted) setAuthChecked(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      setAuthChecked(true);

      if (sessionUser) {
        if (loadedUserIdRef.current !== sessionUser.id || event === 'SIGNED_IN') {
          loadedUserIdRef.current = sessionUser.id;
          loadCloudData(sessionUser);
        }
      } else if (event === 'SIGNED_OUT') {
        loadedUserIdRef.current = null;
        setDailyLogs([]);
        setMedicationLogs([]);
      }
    });

    const handleVisibility = () => {
      if (!supabase) return;
      if (document.visibilityState === 'visible') {
        supabase.auth.startAutoRefresh();
        void supabase.auth.getSession();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadCloudData]);

  // CRUD Handlers
  const handleSaveDailyLog = async (log: DailyLog) => {
    let savedLog = log;
    if (isSupabaseConfigured && user) {
      savedLog = await upsertDailyLogCloud(user.id, log);
    }
    setDailyLogs((prev) => {
      const idx = prev.findIndex((item) => item.date === savedLog.date);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = savedLog;
        return copy;
      }
      return [...prev, savedLog];
    });
    markSaved(isSupabaseConfigured && user ? 'Sincronizado en Supabase' : 'Guardado en sesión');
  };

  const handleDeleteDailyLog = async (date: string) => {
    if (isSupabaseConfigured && user) {
      await deleteDailyLogCloud(user.id, date);
    }
    setDailyLogs((prev) => prev.filter((item) => item.date !== date));
    markSaved('Registro eliminado');
  };

  const handleSaveMedication = async (med: MedicationLog) => {
    let savedMed = med;
    if (isSupabaseConfigured && user) {
      savedMed = await upsertMedicationLogCloud(user.id, med);
    }
    setMedicationLogs((prev) => {
      const idx = prev.findIndex((item) => item.id === med.id || item.id === savedMed.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = savedMed;
        return copy;
      }
      return [...prev, savedMed];
    });
    markSaved(isSupabaseConfigured && user ? 'Medicación sincronizada' : 'Medicación guardada');
  };

  const handleDeleteMedication = async (id: string) => {
    if (isSupabaseConfigured && user) {
      await deleteMedicationLogCloud(user.id, id);
    }
    setMedicationLogs((prev) => prev.filter((item) => item.id !== id));
    markSaved('Medicación eliminada');
  };

  const handleSaveProfile = async (next: UserProfile) => {
    if (isSupabaseConfigured && user) {
      await upsertUserProfileCloud(user.id, next);
    }
    setProfile(next);
    markSaved('Perfil guardado');
  };

  const handleUpdateBackupTimestamp = async (iso: string) => {
    const next = { ...profile, lastBackupAt: iso };
    await handleSaveProfile(next);
  };

  const handleImportData = async (parsed: ParsedImportResult, overwriteExisting: boolean) => {
    const existingDates = new Set(dailyLogs.map((l) => l.date));
    const logsToUpsert: DailyLog[] = [];
    let addedLogs = 0;
    let updatedLogs = 0;
    let skippedLogs = 0;

    parsed.dailyLogs.forEach((incoming) => {
      if (existingDates.has(incoming.date)) {
        if (overwriteExisting) {
          logsToUpsert.push(incoming);
          updatedLogs++;
        } else {
          skippedLogs++;
        }
      } else {
        logsToUpsert.push(incoming);
        addedLogs++;
      }
    });

    // Avoid duplicating identical medication logs on same date + name + volume
    const existingMedKeys = new Set(
      medicationLogs.map((m) => `${m.date}|${m.medName.toLowerCase()}|${m.volumeMl}`)
    );
    const medsToAdd = parsed.medicationLogs.filter(
      (m) => !existingMedKeys.has(`${m.date}|${m.medName.toLowerCase()}|${m.volumeMl}`)
    );

    if (isSupabaseConfigured && user) {
      await Promise.all([
        batchUpsertDailyLogsCloud(user.id, logsToUpsert),
        batchInsertMedicationLogsCloud(user.id, medsToAdd),
      ]);
      if (parsed.profile) {
        const mergedProfile = { ...profile, ...parsed.profile };
        await upsertUserProfileCloud(user.id, mergedProfile);
        setProfile(mergedProfile);
      }
      await loadCloudData(user);
    } else {
      setDailyLogs((prev) => {
        const map = new Map(prev.map((l) => [l.date, l]));
        logsToUpsert.forEach((l) => map.set(l.date, l));
        return Array.from(map.values());
      });
      setMedicationLogs((prev) => [...prev, ...medsToAdd]);
      if (parsed.profile) {
        setProfile((prev) => ({ ...prev, ...parsed.profile }));
      }
    }

    markSaved('Importación completada');
    return {
      addedLogs,
      updatedLogs,
      skippedLogs,
      addedMeds: medsToAdd.length,
    };
  };

  const handleSeedInitialData = async (overwriteExisting: boolean) => {
    const seed = buildInitialData();
    const res = await handleImportData(
      { dailyLogs: seed.dailyLogs, medicationLogs: seed.medicationLogs },
      overwriteExisting
    );
    setOfferInitialCloudSeed(false);
    return res;
  };

  const handleClearAllData = async () => {
    if (isSupabaseConfigured && user) {
      await clearAllUserDataCloud(user.id);
    }
    setDailyLogs([]);
    setMedicationLogs([]);
    markSaved('Datos eliminados');
  };

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSettingsOpen(false);
  };

  // If Supabase IS configured and user is not authenticated yet, show AuthScreen
  if (isSupabaseConfigured && authChecked && !user) {
    return <AuthScreen />;
  }

  if (
    isSupabaseConfigured &&
    (!authChecked || (loadingCloud && dailyLogs.length === 0 && medicationLogs.length === 0))
  ) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-6">
        <RetafitLogo size="lg" />
        <p className="text-xs font-mono text-[#A0A0A0]">Cargando historial sincronizado...</p>
      </div>
    );
  }

  const navItems: Array<{ id: MainTab; label: string; Icon: React.ElementType }> = [
    { id: 'inicio', label: 'Inicio', Icon: Home },
    { id: 'registro', label: 'Registro', Icon: PlusCircle },
    { id: 'graficas', label: 'Gráficas', Icon: BarChart3 },
    { id: 'historial', label: 'Historial', Icon: CalendarDays },
  ];

  const openRegistro = (date?: string, subTab: 'diario' | 'medicacion' = 'diario') => {
    if (date) setSelectedDate(date);
    setRegistroSubTab(subTab);
    setActiveTab('registro');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#080B08] border-r border-[#1f281f] p-5 justify-between z-30">
        <div className="space-y-8">
          <RetafitLogo size="md" />

          <nav className="space-y-1.5" aria-label="Navegación principal">
            {navItems.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    if (id === 'registro') setRegistroSubTab('diario');
                    setActiveTab(id);
                  }}
                  className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#B7FF00] text-black'
                      : 'text-[#A0A0A0] hover:text-white hover:bg-[#191F19]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}

            <div className="pt-4 mt-4 border-t border-[#1f281f] space-y-1.5">
              <button
                type="button"
                onClick={() => openRegistro(selectedDate, 'medicacion')}
                className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'registro' && registroSubTab === 'medicacion'
                    ? 'bg-[#191F19] text-[#B7FF00] border border-[#B7FF00]/30'
                    : 'text-[#A0A0A0] hover:text-white hover:bg-[#191F19]'
                }`}
              >
                <Pill className="w-4 h-4 shrink-0" />
                <span>Medicación</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-medium text-[#A0A0A0] hover:text-white hover:bg-[#191F19] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span>Perfil y Copias</span>
              </button>
            </div>
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-[#1f281f]">
          <PWAInstallButton />
          <div className="text-[11px] text-[#A0A0A0] flex items-center gap-2">
            {isSupabaseConfigured && user ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-[#B7FF00] shrink-0" />
                <span className="truncate">Nube activa · {user.email}</span>
              </>
            ) : (
              <>
                <CloudOff className="w-3.5 h-3.5 text-[#A0A0A0] shrink-0" />
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="text-left hover:text-[#B7FF00] transition-colors cursor-pointer"
                >
                  Supabase sin configurar
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Top Bar (compact <= 56px) */}
      <header className="lg:hidden sticky top-0 z-30 h-14 px-4 bg-[#080B08]/95 backdrop-blur-md border-b border-[#1f281f] flex items-center justify-between gap-3">
        <RetafitLogo size="sm" />
        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-[#A0A0A0] hover:text-white cursor-pointer"
            aria-label="Ajustes, perfil y copias"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 lg:pl-64 pb-24 lg:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
          {/* Save confirmation toast */}
          <AnimatePresence>
            {lastSavedText && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="fixed top-16 lg:top-5 right-4 z-40 rounded-xl bg-[#191F19] border border-[#B7FF00]/50 px-4 py-2.5 text-xs font-medium text-[#B7FF00] shadow-xl flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>{lastSavedText}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Honest Supabase Setup Notice if unconfigured */}
          {!isSupabaseConfigured && !dismissSetupBanner && (
            <div className="rounded-2xl bg-[#191F19] border border-[#2d382d] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-[#A0A0A0]">
                <strong className="text-white">Sesión local en memoria:</strong> los 14 registros históricos iniciales están cargados para trabajar ahora mismo, pero la sincronización entre iPhone y Mac requiere configurar las variables públicas de Supabase y ejecutar{' '}
                <code className="text-[#B7FF00]">supabase/schema.sql</code>.
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="min-h-[36px] px-3 rounded-lg bg-[#B7FF00] text-black font-bold whitespace-nowrap cursor-pointer"
                >
                  Configurar Supabase
                </button>
                <button
                  type="button"
                  onClick={() => setDismissSetupBanner(true)}
                  className="min-h-[36px] px-2.5 rounded-lg text-[#A0A0A0] hover:text-white cursor-pointer"
                >
                  Ocultar
                </button>
              </div>
            </div>
          )}

          {/* First-login Cloud Seed Prompt (only when Supabase DB is empty) */}
          {isSupabaseConfigured && offerInitialCloudSeed && (
            <div className="rounded-2xl bg-[#191F19] border border-[#B7FF00]/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-semibold text-white">Tu cuenta en Supabase está vacía</p>
                <p className="text-[#A0A0A0] mt-0.5">
                  ¿Deseas importar tus 14 registros históricos iniciales (4 al 17 de noviembre de 2026) a la base de datos?
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSeedInitialData(false)}
                  className="min-h-[40px] px-4 rounded-xl bg-[#B7FF00] text-black font-bold whitespace-nowrap cursor-pointer"
                >
                  Importar historial inicial
                </button>
                <button
                  type="button"
                  onClick={() => setOfferInitialCloudSeed(false)}
                  className="min-h-[40px] px-3 rounded-xl text-[#A0A0A0] hover:text-white cursor-pointer"
                >
                  Omitir
                </button>
              </div>
            </div>
          )}

          {cloudError && (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-xs text-red-300">
              {cloudError}
            </div>
          )}

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
          >
            {activeTab === 'inicio' && (
              <DashboardView
                logs={dailyLogs}
                meds={medicationLogs}
                profile={profile}
                onNavigateToLog={(date) => openRegistro(date ?? selectedDate, 'diario')}
                onNavigateToCharts={() => setActiveTab('graficas')}
              />
            )}

            {activeTab === 'registro' && (
              <DailyLogView
                logs={dailyLogs}
                meds={medicationLogs}
                selectedDate={selectedDate}
                initialSubTab={registroSubTab}
                onSelectDate={setSelectedDate}
                onSaveDailyLog={handleSaveDailyLog}
                onDeleteDailyLog={handleDeleteDailyLog}
                onSaveMedication={handleSaveMedication}
                onDeleteMedication={handleDeleteMedication}
              />
            )}

            {activeTab === 'graficas' && (
              <ChartsView logs={dailyLogs} meds={medicationLogs} profile={profile} />
            )}

            {activeTab === 'historial' && (
              <HistoryView
                logs={dailyLogs}
                meds={medicationLogs}
                onEditDay={(date) => openRegistro(date, 'diario')}
                onAddMedicationForDay={(date) => openRegistro(date, 'medicacion')}
                onDeleteDailyLog={handleDeleteDailyLog}
              />
            )}
          </motion.div>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar (4 primary sections) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#080B08]/95 backdrop-blur-md border-t border-[#1f281f] pb-safe"
        aria-label="Navegación móvil"
      >
        <div className="grid grid-cols-4 h-16 items-center">
          {navItems.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (id === 'registro') setRegistroSubTab('diario');
                  setActiveTab(id);
                }}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  active ? 'text-[#B7FF00]' : 'text-[#A0A0A0] hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <SettingsBackupModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        profile={profile}
        logs={dailyLogs}
        meds={medicationLogs}
        isSupabaseConfigured={isSupabaseConfigured}
        userEmail={user?.email ?? null}
        onSaveProfile={handleSaveProfile}
        onImportData={handleImportData}
        onSeedInitialData={handleSeedInitialData}
        onUpdateBackupTimestamp={handleUpdateBackupTimestamp}
        onClearAllData={handleClearAllData}
        onSignOut={handleSignOut}
        onOpenAuthModal={() => setShowAuthModal(true)}
      />

      {showAuthModal && isSupabaseConfigured && (
        <div className="fixed inset-0 z-50 bg-black">
          <AuthScreen onClose={() => setShowAuthModal(false)} />
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
}
