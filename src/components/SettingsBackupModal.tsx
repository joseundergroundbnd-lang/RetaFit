import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  LogOut,
  RotateCcw,
  Shield,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { DailyLog, MedicationLog, Sex, UserProfile } from '../types/retafit';
import { calculateBmrMifflinStJeor } from '../lib/calculations';
import { ParsedImportResult, parseImportedJson } from '../data/initialData';
import { exportFullBackupJson, exportRecordsCsv } from '../lib/exportUtils';
import { ConfirmDialog } from './ConfirmDialog';
import schemaSqlRaw from '../../supabase/schema.sql?raw';

interface SettingsBackupModalProps {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
  logs: DailyLog[];
  meds: MedicationLog[];
  isSupabaseConfigured: boolean;
  userEmail: string | null;
  onSaveProfile: (next: UserProfile) => Promise<void>;
  onImportData: (parsed: ParsedImportResult, overwriteExisting: boolean) => Promise<{
    addedLogs: number;
    updatedLogs: number;
    skippedLogs: number;
    addedMeds: number;
  }>;
  onSeedInitialData: (overwriteExisting: boolean) => Promise<{
    addedLogs: number;
    updatedLogs: number;
    skippedLogs: number;
    addedMeds: number;
  }>;
  onUpdateBackupTimestamp: (iso: string) => Promise<void>;
  onClearAllData: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onOpenAuthModal: () => void;
}

const SQL_SNIPPET_LINK = 'Disponible en /supabase/schema.sql';

export const SettingsBackupModal: React.FC<SettingsBackupModalProps> = ({
  open,
  onClose,
  profile,
  logs,
  meds,
  isSupabaseConfigured,
  userEmail,
  onSaveProfile,
  onImportData,
  onSeedInitialData,
  onUpdateBackupTimestamp,
  onClearAllData,
  onSignOut,
  onOpenAuthModal,
}) => {
  const [tab, setTab] = useState<'perfil' | 'copias' | 'supabase'>('perfil');
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [savingProfile, setSavingProfile] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(profile);
    }
  }, [open, profile]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jsonText, setJsonText] = useState('');
  const [pendingImport, setPendingImport] = useState<{
    parsed: ParsedImportResult;
    overlappingDates: number;
  } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  if (!open) return null;

  const bmrPreview = calculateBmrMifflinStJeor(draft);
  const targetWeightPreview = Number((draft.referenceWeightKg - draft.targetLossKg).toFixed(1));

  const showMsg = (msg: string) => {
    setErrorMsg(null);
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setErrorMsg(null);
    try {
      await onSaveProfile(draft);
      showMsg('Datos personales y objetivos guardados.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar el perfil.');
    } finally {
      setSavingProfile(false);
    }
  };

  const processParsedImport = async (parsed: ParsedImportResult) => {
    const existingDates = new Set(logs.map((l) => l.date));
    const overlapping = parsed.dailyLogs.filter((l) => existingDates.has(l.date)).length;

    if (overlapping > 0) {
      setPendingImport({ parsed, overlappingDates: overlapping });
      return;
    }

    const res = await onImportData(parsed, false);
    showMsg(
      `Importación completada: ${res.addedLogs} días añadidos, ${res.addedMeds} registros de medicación.`
    );
    setJsonText('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    try {
      const text = await file.text();
      const parsed = parseImportedJson(text);
      await processParsedImport(parsed);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al leer el archivo JSON.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePasteImport = async () => {
    setErrorMsg(null);
    try {
      const parsed = parseImportedJson(jsonText);
      await processParsedImport(parsed);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'JSON inválido.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-[#191F19] border border-[#2d382d] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#263026] bg-[#080B08]">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              Perfil, copias de seguridad y nube
            </h2>
            <p className="text-xs text-[#A0A0A0]">
              {isSupabaseConfigured
                ? userEmail
                  ? `Conectado a Supabase · ${userEmail}`
                  : 'Supabase configurado · Inicia sesión'
                : 'Modo sesión local (sin credenciales Supabase configuradas)'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-[#A0A0A0] hover:text-white cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-nav tabs */}
        <div className="px-5 sm:px-6 pt-3 pb-2 border-b border-[#263026] flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'perfil' as const, label: 'Datos y objetivos', Icon: User },
            { id: 'copias' as const, label: 'Copias e importación', Icon: FileJson },
            { id: 'supabase' as const, label: 'Supabase y RLS', Icon: Database },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tab === id
                  ? 'bg-[#B7FF00] text-black'
                  : 'bg-[#080B08] text-[#A0A0A0] hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {feedback && (
            <div className="flex items-center gap-2 text-xs text-[#B7FF00] bg-[#B7FF00]/10 border border-[#B7FF00]/30 rounded-xl p-3">
              <Check className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}
          {errorMsg && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl p-3">
              {errorMsg}
            </div>
          )}

          {tab === 'perfil' && (
            <form onSubmit={handleProfileSave} className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs text-[#A0A0A0]">Sexo</span>
                  <select
                    value={draft.sex}
                    onChange={(e) => setDraft({ ...draft, sex: e.target.value as Sex })}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-[#080B08] border border-[#2c362c] text-sm text-white"
                  >
                    <option value="male">Hombre</option>
                    <option value="female">Mujer</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-[#A0A0A0]">Edad (años)</span>
                  <input
                    type="number"
                    value={draft.age}
                    onChange={(e) => setDraft({ ...draft, age: Number(e.target.value) || 0 })}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-[#080B08] border border-[#2c362c] text-sm font-mono text-white"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-[#A0A0A0]">Altura (cm)</span>
                  <input
                    type="number"
                    value={draft.heightCm}
                    onChange={(e) => setDraft({ ...draft, heightCm: Number(e.target.value) || 0 })}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-[#080B08] border border-[#2c362c] text-sm font-mono text-white"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-[#A0A0A0]">Peso referencia (kg)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={draft.referenceWeightKg}
                    onChange={(e) =>
                      setDraft({ ...draft, referenceWeightKg: Number(e.target.value) || 0 })
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl bg-[#080B08] border border-[#2c362c] text-sm font-mono text-white"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-[#A0A0A0]">Objetivo pérdida (kg)</span>
                  <input
                    type="number"
                    step="0.5"
                    value={draft.targetLossKg}
                    onChange={(e) =>
                      setDraft({ ...draft, targetLossKg: Number(e.target.value) || 0 })
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl bg-[#080B08] border border-[#334233] text-sm font-mono text-[#B7FF00]"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-[#A0A0A0]">Calorías objetivo</span>
                  <input
                    type="number"
                    value={draft.targetCalories}
                    onChange={(e) =>
                      setDraft({ ...draft, targetCalories: Number(e.target.value) || 0 })
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl bg-[#080B08] border border-[#2c362c] text-sm font-mono text-white"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-[#A0A0A0]">Proteínas objetivo (g)</span>
                  <input
                    type="number"
                    value={draft.targetProteinG}
                    onChange={(e) =>
                      setDraft({ ...draft, targetProteinG: Number(e.target.value) || 0 })
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl bg-[#080B08] border border-[#334233] text-sm font-mono text-[#B7FF00]"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-[#A0A0A0]">Grasas objetivo (g)</span>
                  <input
                    type="number"
                    value={draft.targetFatG}
                    onChange={(e) =>
                      setDraft({ ...draft, targetFatG: Number(e.target.value) || 0 })
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl bg-[#080B08] border border-[#2c362c] text-sm font-mono text-white"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-[#A0A0A0]">Hidratos objetivo (g)</span>
                  <input
                    type="number"
                    value={draft.targetCarbsG}
                    onChange={(e) =>
                      setDraft({ ...draft, targetCarbsG: Number(e.target.value) || 0 })
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl bg-[#080B08] border border-[#2c362c] text-sm font-mono text-white"
                  />
                </label>

                <label className="block space-y-1 col-span-2 sm:col-span-3">
                  <span className="text-xs text-[#A0A0A0]">
                    Gasto energético total estimado editable (kcal/día)
                  </span>
                  <input
                    type="number"
                    value={draft.estimatedTdee}
                    onChange={(e) =>
                      setDraft({ ...draft, estimatedTdee: Number(e.target.value) || 0 })
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl bg-[#080B08] border border-[#334233] text-sm font-mono text-[#B7FF00]"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs text-[#A0A0A0]">Actividad habitual orientativa</span>
                <textarea
                  rows={2}
                  value={draft.habitualActivityNote}
                  onChange={(e) =>
                    setDraft({ ...draft, habitualActivityNote: e.target.value })
                  }
                  className="w-full p-3 rounded-xl bg-[#080B08] border border-[#2c362c] text-sm text-white"
                />
              </label>

              <div className="rounded-xl bg-[#080B08] border border-[#263026] p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <span className="text-[#A0A0A0] block">Metabolismo basal (Mifflin-St Jeor)</span>
                  <span className="font-mono text-lg font-bold text-[#B7FF00] tabular-nums">
                    {bmrPreview.toLocaleString('es-ES')} kcal/día
                  </span>
                </div>
                <div>
                  <span className="text-[#A0A0A0] block">Peso objetivo resultante</span>
                  <span className="font-mono text-lg font-bold text-white tabular-nums">
                    {targetWeightPreview} kg
                  </span>
                </div>
                <div>
                  <span className="text-[#A0A0A0] block">Déficit objetivo estimado</span>
                  <span className="font-mono text-lg font-bold text-white tabular-nums">
                    {draft.estimatedTdee - draft.targetCalories} kcal/día
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="min-h-[46px] px-6 rounded-xl bg-[#B7FF00] text-black font-bold text-sm hover:bg-[#c8ff33] cursor-pointer"
                >
                  {savingProfile ? 'Guardando...' : 'Guardar configuración personal'}
                </button>
              </div>
            </form>
          )}

          {tab === 'copias' && (
            <div className="space-y-6">
              <div className="rounded-xl bg-[#080B08] border border-[#263026] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="text-[#A0A0A0] block">Última copia de seguridad</span>
                  <span className="font-mono text-sm text-white font-semibold">
                    {profile.lastBackupAt
                      ? new Date(profile.lastBackupAt).toLocaleString('es-ES')
                      : 'Todavía no se ha descargado ninguna copia'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const ts = exportFullBackupJson(profile, logs, meds);
                      await onUpdateBackupTimestamp(ts);
                      showMsg('Copia de seguridad JSON descargada.');
                    }}
                    className="min-h-[44px] px-4 rounded-xl bg-[#B7FF00] text-black font-bold text-xs inline-flex items-center gap-2 hover:bg-[#c8ff33] cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar copia JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ts = exportRecordsCsv(logs, meds);
                      await onUpdateBackupTimestamp(ts);
                      showMsg('Registros exportados a CSV.');
                    }}
                    className="min-h-[44px] px-4 rounded-xl bg-[#191F19] border border-[#2d382d] text-white font-semibold text-xs inline-flex items-center gap-2 hover:border-[#B7FF00] cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#B7FF00]" />
                    <span>Exportar CSV</span>
                  </button>
                </div>
              </div>

              {/* JSON Import */}
              <div className="space-y-3 border-t border-[#263026] pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-white">
                      Importar datos JSON
                    </h3>
                    <p className="text-xs text-[#A0A0A0]">
                      No duplica fechas ni sobrescribe datos existentes sin pedir confirmación.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/json,.json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[42px] px-4 rounded-xl bg-[#080B08] border border-[#B7FF00]/40 text-[#B7FF00] font-semibold text-xs inline-flex items-center gap-2 hover:bg-[#101610] cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Seleccionar archivo .json</span>
                    </button>
                  </div>
                </div>

                <textarea
                  rows={4}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder='Pega aquí un array JSON de registros o una copia de seguridad RETAFIT...'
                  className="w-full p-3 rounded-xl bg-[#080B08] border border-[#2c362c] text-xs font-mono text-white placeholder:font-sans placeholder:text-[#4c574c]"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const existingDates = new Set(logs.map((l) => l.date));
                      if (existingDates.size > 0) {
                        const res = await onSeedInitialData(false);
                        showMsg(
                          `Historial inicial comprobado: ${res.addedLogs} añadidos, ${res.skippedLogs} ya existentes omitidos.`
                        );
                      } else {
                        const res = await onSeedInitialData(false);
                        showMsg(`Historial inicial cargado: ${res.addedLogs} días y ${res.addedMeds} medicaciones.`);
                      }
                    }}
                    className="min-h-[40px] px-3.5 rounded-xl bg-[#080B08] border border-[#2c362c] text-xs font-medium text-[#A0A0A0] hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Importar historial inicial (4–17 nov 2026)</span>
                  </button>

                  <button
                    type="button"
                    disabled={!jsonText.trim()}
                    onClick={handlePasteImport}
                    className="min-h-[40px] px-4 rounded-xl bg-[#B7FF00] text-black font-bold text-xs disabled:opacity-40 cursor-pointer"
                  >
                    Importar JSON pegado
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="border-t border-[#263026] pt-4 flex items-center justify-between gap-4">
                <div className="text-xs">
                  <span className="font-semibold text-white block">Borrar todos los registros</span>
                  <span className="text-[#A0A0A0]">
                    Elimina diarios y medicaciones tras confirmar. Descarga una copia antes.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="min-h-[42px] px-4 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Borrar todo</span>
                </button>
              </div>
            </div>
          )}

          {tab === 'supabase' && (
            <div className="space-y-4 text-xs leading-relaxed">
              <div className="rounded-xl bg-[#080B08] border border-[#263026] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-[#B7FF00] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-white">
                      {isSupabaseConfigured
                        ? userEmail
                          ? 'Sincronización en la nube activa'
                          : 'Supabase configurado (requiere inicio de sesión)'
                        : 'Conexión Supabase pendiente de configurar'}
                    </p>
                    <p className="text-[#A0A0A0] mt-0.5">
                      {isSupabaseConfigured
                        ? 'Todas las tablas están protegidas por Row Level Security (auth.uid() = user_id).'
                        : 'No se está simulando ninguna conexión en la nube. Añade tus credenciales públicas de Supabase para sincronizar entre iPhone y Mac.'}
                    </p>
                  </div>
                </div>

                {isSupabaseConfigured ? (
                  userEmail ? (
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="min-h-[40px] px-4 rounded-xl border border-[#2d382d] text-white hover:border-[#B7FF00] inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Cerrar sesión</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAuthModal();
                      }}
                      className="min-h-[40px] px-4 rounded-xl bg-[#B7FF00] text-black font-bold whitespace-nowrap cursor-pointer"
                    >
                      Iniciar sesión
                    </button>
                  )
                ) : null}
              </div>

              <div className="rounded-xl bg-[#080B08] border border-[#263026] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-white">
                    Instrucciones exactas de conexión (PostgreSQL + RLS)
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(schemaSqlRaw);
                        setCopiedSql(true);
                        setTimeout(() => setCopiedSql(false), 2500);
                      }}
                      className="min-h-[36px] px-3 rounded-lg bg-[#B7FF00] text-black font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedSql ? 'SQL copiado' : 'Copiar SQL'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([schemaSqlRaw], { type: 'text/sql;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'schema.sql';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="min-h-[36px] px-3 rounded-lg bg-[#191F19] border border-[#2d382d] text-white font-semibold text-xs inline-flex items-center gap-1.5 hover:border-[#B7FF00] cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#B7FF00]" />
                      <span>Descargar schema.sql</span>
                    </button>
                  </div>
                </div>
                <ol className="space-y-2 text-[#A0A0A0] list-decimal list-inside">
                  <li>
                    Pulsa <strong className="text-white">Copiar SQL</strong> arriba, pégalo en el{' '}
                    <strong className="text-white">SQL Editor</strong> de tu proyecto Supabase y pulsa{' '}
                    <strong className="text-white">Run</strong>.
                  </li>
                  <li>
                    En <strong className="text-white">Authentication → Sign In / Providers</strong>{' '}
                    comprueba que <strong className="text-white">Email</strong> esté activado.
                  </li>
                  <li>
                    En <strong className="text-white">Project Settings → API</strong> copia tu{' '}
                    <code className="text-white">Project URL</code> y clave pública{' '}
                    <code className="text-white">anon</code> y añádelas en las variables de entorno de tu hosting (p. ej. Vercel) o archivo <code className="text-white">.env</code>:
                  </li>
                </ol>

                <div className="relative rounded-xl bg-black border border-[#263026] p-3 font-mono text-[11px] text-[#B7FF00]">
                  <pre className="overflow-x-auto">{`VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"\nVITE_SUPABASE_ANON_KEY="tu-clave-publica-anon"`}</pre>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(
                        'VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"\nVITE_SUPABASE_ANON_KEY="tu-clave-publica-anon"'
                      );
                      setCopiedEnv(true);
                      setTimeout(() => setCopiedEnv(false), 2000);
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[#A0A0A0] hover:text-white cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedEnv ? 'Copiado' : 'Copiar variables'}</span>
                  </button>
                </div>

                <details className="rounded-xl bg-black border border-[#263026] p-3">
                  <summary className="text-xs font-mono text-[#A0A0A0] hover:text-white cursor-pointer select-none">
                    Ver SQL completo ({SQL_SNIPPET_LINK})
                  </summary>
                  <pre className="mt-3 max-h-56 overflow-auto text-[11px] font-mono text-[#A0A0A0] leading-relaxed">
                    {schemaSqlRaw}
                  </pre>
                </details>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm overwrite on overlapping dates */}
      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="Fechas coincidentes detectadas"
        description={
          pendingImport
            ? `El archivo contiene ${pendingImport.overlappingDates} fecha(s) que ya existen en tu historial. ¿Deseas omitir las fechas existentes para conservar tus datos actuales o sobrescribirlas con las del archivo?`
            : ''
        }
        confirmLabel="Omitir existentes (seguro)"
        secondaryActionLabel="Sobrescribir existentes"
        onCancel={() => setPendingImport(null)}
        onConfirm={async () => {
          if (!pendingImport) return;
          const res = await onImportData(pendingImport.parsed, false);
          setPendingImport(null);
          setJsonText('');
          showMsg(
            `Importado: ${res.addedLogs} nuevos, ${res.skippedLogs} existentes omitidos, ${res.addedMeds} medicaciones.`
          );
        }}
        onSecondaryAction={async () => {
          if (!pendingImport) return;
          const res = await onImportData(pendingImport.parsed, true);
          setPendingImport(null);
          setJsonText('');
          showMsg(
            `Importado: ${res.addedLogs} nuevos, ${res.updatedLogs} sobrescritos, ${res.addedMeds} medicaciones.`
          );
        }}
      />

      {/* Confirm clear all */}
      <ConfirmDialog
        open={confirmClear}
        danger
        title="¿Borrar todos los registros?"
        description="Se eliminarán todos los registros diarios y administraciones de medicación. Esta acción es irreversible."
        confirmLabel="Sí, borrar todo"
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          setConfirmClear(false);
          await onClearAllData();
          showMsg('Todos los registros han sido eliminados.');
        }}
      />
    </div>
  );
};
