import React, { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Pill, Save, Trash2, AlertCircle } from 'lucide-react';
import { DailyLog, MedicationLog } from '../types/retafit';
import { formatFullDateEs } from '../lib/calculations';
import { ConfirmDialog } from './ConfirmDialog';

interface DailyLogViewProps {
  logs: DailyLog[];
  meds: MedicationLog[];
  selectedDate: string;
  initialSubTab?: 'diario' | 'medicacion';
  onSelectDate: (date: string) => void;
  onSaveDailyLog: (log: DailyLog) => Promise<void>;
  onDeleteDailyLog: (date: string) => Promise<void>;
  onSaveMedication: (med: MedicationLog) => Promise<void>;
  onDeleteMedication: (id: string) => Promise<void>;
}

const EXERCISE_PRESETS = ['Caminata', 'Fuerza', 'Cardio', 'Mixto', 'Descanso'];
const MED_PRESETS = ['Mounjaro', 'Retatrutida'];

function numToInput(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v);
}

function parseNullableFloat(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') return null;
  const val = Number(trimmed);
  return Number.isFinite(val) ? val : null;
}

function parseNullableInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const val = Math.round(Number(trimmed));
  return Number.isFinite(val) ? val : null;
}

function shiftIsoDate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

export const DailyLogView: React.FC<DailyLogViewProps> = ({
  logs,
  meds,
  selectedDate,
  initialSubTab = 'diario',
  onSelectDate,
  onSaveDailyLog,
  onDeleteDailyLog,
  onSaveMedication,
  onDeleteMedication,
}) => {
  const [subTab, setSubTab] = useState<'diario' | 'medicacion'>(initialSubTab);

  // Daily Form State
  const existingDay = logs.find((l) => l.date === selectedDate);
  const [weight, setWeight] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [activeCalories, setActiveCalories] = useState('');
  const [steps, setSteps] = useState('');
  const [exerciseType, setExerciseType] = useState('');
  const [exerciseDuration, setExerciseDuration] = useState('');
  const [notes, setNotes] = useState('');

  const [savingDaily, setSavingDaily] = useState(false);
  const [dailyFeedback, setDailyFeedback] = useState<string | null>(null);
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [confirmDeleteDay, setConfirmDeleteDay] = useState(false);

  // Medication Form State
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [medDate, setMedDate] = useState(selectedDate);
  const [medName, setMedName] = useState('Retatrutida');
  const [volumeMl, setVolumeMl] = useState('');
  const [concentrationMgMl, setConcentrationMgMl] = useState('');
  const [medNotes, setMedNotes] = useState('');
  const [savingMed, setSavingMed] = useState(false);
  const [medFeedback, setMedFeedback] = useState<string | null>(null);
  const [medError, setMedError] = useState<string | null>(null);
  const [medToDelete, setMedToDelete] = useState<MedicationLog | null>(null);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    setWeight(numToInput(existingDay?.weightKg));
    setCalories(numToInput(existingDay?.calories));
    setProtein(numToInput(existingDay?.proteinG));
    setCarbs(numToInput(existingDay?.carbsG));
    setFat(numToInput(existingDay?.fatG));
    setActiveCalories(numToInput(existingDay?.activeCalories));
    setSteps(numToInput(existingDay?.steps));
    setExerciseType(existingDay?.exerciseType ?? '');
    setExerciseDuration(numToInput(existingDay?.exerciseDurationMin));
    setNotes(existingDay?.notes ?? '');
    setDailyError(null);
  }, [selectedDate, existingDay]);

  useEffect(() => {
    if (!editingMedId) {
      setMedDate(selectedDate);
    }
  }, [selectedDate, editingMedId]);

  const handleDailySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDailyError(null);

    const parsedWeight = parseNullableFloat(weight);
    const parsedCal = parseNullableInt(calories);
    const parsedPro = parseNullableInt(protein);
    const parsedCarb = parseNullableInt(carbs);
    const parsedFat = parseNullableInt(fat);
    const parsedAct = parseNullableInt(activeCalories);
    const parsedSteps = parseNullableInt(steps);
    const parsedDur = parseNullableInt(exerciseDuration);

    if (parsedWeight !== null && (parsedWeight < 25 || parsedWeight > 350)) {
      setDailyError('Introduce un peso válido entre 25 y 350 kg.');
      return;
    }
    if (
      parsedCal === null &&
      parsedWeight === null &&
      parsedPro === null &&
      parsedCarb === null &&
      parsedFat === null &&
      parsedAct === null &&
      parsedSteps === null &&
      !exerciseType.trim() &&
      parsedDur === null &&
      !notes.trim()
    ) {
      setDailyError('Introduce al menos un dato para guardar el registro del día.');
      return;
    }

    setSavingDaily(true);
    try {
      await onSaveDailyLog({
        id: existingDay?.id ?? `log-${selectedDate}-${Date.now()}`,
        date: selectedDate,
        weightKg: parsedWeight,
        calories: parsedCal,
        proteinG: parsedPro,
        carbsG: parsedCarb,
        fatG: parsedFat,
        activeCalories: parsedAct,
        steps: parsedSteps,
        exerciseType: exerciseType.trim() || null,
        exerciseDurationMin: parsedDur,
        notes: notes.trim() || null,
      });
      setDailyFeedback(`Guardado correctamente (${formatFullDateEs(selectedDate)})`);
      setTimeout(() => setDailyFeedback(null), 3500);
    } catch (err) {
      setDailyError(err instanceof Error ? err.message : 'Error al guardar el registro.');
    } finally {
      setSavingDaily(false);
    }
  };

  const handleMedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMedError(null);
    const parsedVol = parseNullableFloat(volumeMl);
    const parsedConc = parseNullableFloat(concentrationMgMl);

    if (!medName.trim()) {
      setMedError('Indica el nombre del medicamento.');
      return;
    }
    if (parsedVol === null || parsedVol <= 0) {
      setMedError('Introduce un volumen administrado válido en ml.');
      return;
    }

    setSavingMed(true);
    try {
      await onSaveMedication({
        id: editingMedId ?? `med-${medDate}-${Date.now()}`,
        date: medDate,
        medName: medName.trim(),
        volumeMl: parsedVol,
        concentrationMgMl: parsedConc,
        notes: medNotes.trim() || null,
      });
      setMedFeedback(
        editingMedId
          ? 'Administración actualizada.'
          : `Registrado ${medName.trim()} (${parsedVol} ml)`
      );
      setEditingMedId(null);
      setVolumeMl('');
      setConcentrationMgMl('');
      setMedNotes('');
      setTimeout(() => setMedFeedback(null), 3500);
    } catch (err) {
      setMedError(err instanceof Error ? err.message : 'Error al guardar la medicación.');
    } finally {
      setSavingMed(false);
    }
  };

  const sortedMeds = [...meds].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {subTab === 'diario' ? 'Registro diario rápido' : 'Medicación'}
          </h1>
          <p className="text-xs text-[#A0A0A0] mt-1">
            {subTab === 'diario'
              ? 'Los campos vacíos se conservan como ausentes, nunca como cero.'
              : 'Registro histórico en ml. No convierte unidades sin concentración fiable.'}
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#191F19] border border-[#2a342a] self-start">
          <button
            type="button"
            onClick={() => setSubTab('diario')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'diario' ? 'bg-[#B7FF00] text-black' : 'text-[#A0A0A0] hover:text-white'
            }`}
          >
            Registro diario
          </button>
          <button
            type="button"
            onClick={() => setSubTab('medicacion')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'medicacion'
                ? 'bg-[#B7FF00] text-black'
                : 'text-[#A0A0A0] hover:text-white'
            }`}
          >
            Medicación
          </button>
        </div>
      </div>

      {subTab === 'diario' ? (
        <form
          onSubmit={handleDailySubmit}
          className="rounded-2xl bg-[#191F19] border border-[#2a342a] p-5 sm:p-6 space-y-6"
        >
          {/* Date Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#263026]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectDate(shiftIsoDate(selectedDate, -1))}
                className="min-h-[44px] min-w-[44px] rounded-xl bg-[#080B08] border border-[#2c362c] flex items-center justify-center text-white hover:border-[#B7FF00] transition-colors cursor-pointer"
                aria-label="Día anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && onSelectDate(e.target.value)}
                className="min-h-[44px] px-3.5 rounded-xl bg-[#080B08] border border-[#2c362c] text-white font-mono text-sm focus:outline-none focus:border-[#B7FF00]"
              />
              <button
                type="button"
                onClick={() => onSelectDate(shiftIsoDate(selectedDate, 1))}
                className="min-h-[44px] min-w-[44px] rounded-xl bg-[#080B08] border border-[#2c362c] flex items-center justify-center text-white hover:border-[#B7FF00] transition-colors cursor-pointer"
                aria-label="Día siguiente"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-[#A0A0A0]">
                {existingDay ? 'Editando fecha existente' : 'Nueva fecha sin datos previos'}
              </span>
              {existingDay && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteDay(true)}
                  className="min-h-[40px] px-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 inline-flex items-center gap-1.5 font-medium cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
              )}
            </div>
          </div>

          {/* Numeric Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { label: 'Peso (kg)', value: weight, setter: setWeight, step: '0.05', placeholder: '89.90', accent: true },
              { label: 'Calorías ingeridas (kcal)', value: calories, setter: setCalories, step: '1', placeholder: '1850', accent: true },
              { label: 'Proteínas (g)', value: protein, setter: setProtein, step: '1', placeholder: '175', accent: true },
              { label: 'Hidratos (g)', value: carbs, setter: setCarbs, step: '1', placeholder: '140' },
              { label: 'Grasas (g)', value: fat, setter: setFat, step: '1', placeholder: '55' },
              { label: 'Calorías activas (kcal)', value: activeCalories, setter: setActiveCalories, step: '1', placeholder: '600' },
              { label: 'Pasos (opcional)', value: steps, setter: setSteps, step: '1', placeholder: '9500' },
              { label: 'Duración ejercicio (min)', value: exerciseDuration, setter: setExerciseDuration, step: '1', placeholder: '60' },
            ].map((field) => (
              <label key={field.label} className="block space-y-1.5">
                <span className="text-xs font-medium text-[#A0A0A0] block">{field.label}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step={field.step}
                  min="0"
                  value={field.value}
                  onChange={(e) => field.setter(e.target.value)}
                  placeholder={`Ausente (ej. ${field.placeholder})`}
                  className={`w-full min-h-[48px] px-3.5 rounded-xl bg-[#080B08] border text-base font-mono tabular-nums focus:outline-none transition-colors ${
                    field.accent
                      ? 'border-[#334233] text-[#B7FF00] focus:border-[#B7FF00]'
                      : 'border-[#2c362c] text-white focus:border-[#B7FF00]'
                  } placeholder:text-[#4c574c] placeholder:text-xs placeholder:font-sans`}
                />
              </label>
            ))}
          </div>

          {/* Exercise Type & Notes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
            <div className="space-y-2">
              <span className="text-xs font-medium text-[#A0A0A0] block">Tipo de ejercicio</span>
              <div className="flex flex-wrap gap-2">
                {EXERCISE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      setExerciseType((prev) => (prev === preset ? '' : preset))
                    }
                    className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      exerciseType === preset
                        ? 'bg-[#B7FF00] text-black border-[#B7FF00]'
                        : 'bg-[#080B08] text-[#A0A0A0] border-[#2c362c] hover:text-white'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={exerciseType}
                onChange={(e) => setExerciseType(e.target.value)}
                placeholder="Otro tipo (opcional)"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#080B08] border border-[#2c362c] text-sm text-white placeholder:text-[#4c574c] focus:outline-none focus:border-[#B7FF00]"
              />
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-medium text-[#A0A0A0] block">Observaciones</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sensaciones, hidratación, sueño, descanso o notas del entrenamiento..."
                className="w-full p-3.5 rounded-xl bg-[#080B08] border border-[#2c362c] text-sm text-white placeholder:text-[#4c574c] focus:outline-none focus:border-[#B7FF00]"
              />
            </label>
          </div>

          {dailyError && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{dailyError}</span>
            </div>
          )}

          {dailyFeedback && (
            <div className="flex items-center gap-2 text-xs text-[#B7FF00] bg-[#B7FF00]/10 border border-[#B7FF00]/30 rounded-xl p-3">
              <Check className="w-4 h-4 shrink-0" />
              <span>{dailyFeedback}</span>
            </div>
          )}

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={savingDaily}
              className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl bg-[#B7FF00] text-black font-bold text-sm hover:bg-[#c8ff33] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{savingDaily ? 'Guardando...' : 'Guardar registro del día'}</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Medication Form */}
          <form
            onSubmit={handleMedSubmit}
            className="lg:col-span-5 rounded-2xl bg-[#191F19] border border-[#2a342a] p-5 sm:p-6 space-y-4 self-start"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Pill className="w-4 h-4 text-[#B7FF00]" />
                <span>{editingMedId ? 'Editar administración' : 'Nueva administración'}</span>
              </h2>
              {editingMedId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMedId(null);
                    setVolumeMl('');
                    setConcentrationMgMl('');
                    setMedNotes('');
                  }}
                  className="text-xs text-[#A0A0A0] hover:text-white cursor-pointer"
                >
                  Cancelar edición
                </button>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-[#A0A0A0] block">Medicamento</span>
              <div className="flex flex-wrap gap-2">
                {MED_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMedName(preset)}
                    className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      medName === preset
                        ? 'bg-[#B7FF00] text-black border-[#B7FF00]'
                        : 'bg-[#080B08] text-[#A0A0A0] border-[#2c362c] hover:text-white'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                placeholder="Nombre del medicamento"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#080B08] border border-[#2c362c] text-sm text-white focus:outline-none focus:border-[#B7FF00]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#A0A0A0] block">Fecha</span>
                <input
                  type="date"
                  value={medDate}
                  onChange={(e) => setMedDate(e.target.value)}
                  className="w-full min-h-[46px] px-3.5 rounded-xl bg-[#080B08] border border-[#2c362c] text-sm font-mono text-white focus:outline-none focus:border-[#B7FF00]"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#A0A0A0] block">Volumen (ml)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.05"
                  min="0"
                  value={volumeMl}
                  onChange={(e) => setVolumeMl(e.target.value)}
                  placeholder="Ej. 2.0"
                  className="w-full min-h-[46px] px-3.5 rounded-xl bg-[#080B08] border border-[#334233] text-base font-mono text-[#B7FF00] tabular-nums focus:outline-none focus:border-[#B7FF00]"
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#A0A0A0] block">
                Concentración en mg/ml (opcional)
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={concentrationMgMl}
                onChange={(e) => setConcentrationMgMl(e.target.value)}
                placeholder="Dejar vacío si no se conoce con exactitud"
                className="w-full min-h-[46px] px-3.5 rounded-xl bg-[#080B08] border border-[#2c362c] text-sm font-mono text-white placeholder:font-sans placeholder:text-xs placeholder:text-[#4c574c] focus:outline-none focus:border-[#B7FF00]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#A0A0A0] block">Observaciones</span>
              <textarea
                rows={2}
                value={medNotes}
                onChange={(e) => setMedNotes(e.target.value)}
                placeholder="Notas personales del registro..."
                className="w-full p-3 rounded-xl bg-[#080B08] border border-[#2c362c] text-sm text-white placeholder:text-[#4c574c] focus:outline-none focus:border-[#B7FF00]"
              />
            </label>

            <p className="text-[11px] text-[#A0A0A0] leading-relaxed border-t border-[#263026] pt-3">
              El volumen en ml y la cantidad en mg son unidades distintas. RETAFIT conserva exactamente los ml introducidos y nunca convierte a mg sin una concentración declarada, ni emite pautas médicas.
            </p>

            {medError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl p-3">
                {medError}
              </div>
            )}
            {medFeedback && (
              <div className="text-xs text-[#B7FF00] bg-[#B7FF00]/10 border border-[#B7FF00]/30 rounded-xl p-3 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{medFeedback}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={savingMed}
              className="w-full min-h-[48px] rounded-xl bg-[#B7FF00] text-black font-bold text-sm hover:bg-[#c8ff33] active:scale-[0.98] transition-all cursor-pointer"
            >
              {savingMed
                ? 'Guardando...'
                : editingMedId
                ? 'Actualizar administración'
                : 'Registrar administración'}
            </button>
          </form>

          {/* Medication History List */}
          <div className="lg:col-span-7 rounded-2xl bg-[#191F19] border border-[#2a342a] p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-white">
                Historial de medicación ({sortedMeds.length})
              </h2>
            </div>

            {sortedMeds.length === 0 ? (
              <p className="text-sm text-[#A0A0A0] py-8 text-center">
                No hay administraciones registradas.
              </p>
            ) : (
              <div className="divide-y divide-[#263026]">
                {sortedMeds.map((m) => (
                  <div
                    key={m.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-white">{m.medName}</span>
                        <span className="text-[#A0A0A0]" aria-hidden="true">·</span>
                        <span className="font-mono font-bold text-[#B7FF00] tabular-nums">
                          {m.volumeMl} ml
                        </span>
                        {m.concentrationMgMl !== null && (
                          <>
                            <span className="text-[#A0A0A0]" aria-hidden="true">·</span>
                            <span className="font-mono text-xs text-[#A0A0A0] tabular-nums">
                              {m.concentrationMgMl} mg/ml ({(m.volumeMl * m.concentrationMgMl).toFixed(2)} mg)
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-[#A0A0A0]">
                        <span className="font-mono">{formatFullDateEs(m.date)}</span>
                        {m.notes ? ` · ${m.notes}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMedId(m.id);
                          setMedDate(m.date);
                          setMedName(m.medName);
                          setVolumeMl(String(m.volumeMl));
                          setConcentrationMgMl(numToInput(m.concentrationMgMl));
                          setMedNotes(m.notes ?? '');
                        }}
                        className="min-h-[40px] px-3 rounded-xl bg-[#080B08] border border-[#2c362c] text-xs font-medium text-white hover:border-[#B7FF00] cursor-pointer"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setMedToDelete(m)}
                        className="min-h-[40px] min-w-[40px] rounded-xl bg-[#080B08] border border-red-500/25 text-red-400 hover:bg-red-500/10 flex items-center justify-center cursor-pointer"
                        aria-label="Eliminar administración"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteDay}
        danger
        title={`Eliminar registro del ${formatFullDateEs(selectedDate)}`}
        description="Esta acción eliminará los datos de peso, nutrición y actividad física de este día. No se puede deshacer."
        confirmLabel="Eliminar día"
        onCancel={() => setConfirmDeleteDay(false)}
        onConfirm={async () => {
          setConfirmDeleteDay(false);
          await onDeleteDailyLog(selectedDate);
        }}
      />

      <ConfirmDialog
        open={Boolean(medToDelete)}
        danger
        title="Eliminar registro de medicación"
        description={
          medToDelete
            ? `Se eliminará ${medToDelete.medName} (${medToDelete.volumeMl} ml) del ${formatFullDateEs(medToDelete.date)}.`
            : ''
        }
        confirmLabel="Eliminar"
        onCancel={() => setMedToDelete(null)}
        onConfirm={async () => {
          if (medToDelete) {
            await onDeleteMedication(medToDelete.id);
            setMedToDelete(null);
          }
        }}
      />
    </div>
  );
};
