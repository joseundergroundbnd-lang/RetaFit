import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { DailyLog, MedicationLog, UserProfile } from '../types/retafit';
import { DEFAULT_PROFILE } from '../data/initialData';

function normalizeSupabaseUrl(raw: string | undefined): string {
  if (!raw) return '';
  const cleaned = raw.trim().replace(/^["']|["']$/g, '');
  try {
    const parsed = new URL(cleaned);
    if (parsed.hostname === 'supabase.com' || parsed.hostname === 'app.supabase.com') {
      const match = parsed.pathname.match(/\/project\/([a-z0-9-]+)/i);
      if (match?.[1]) {
        return `https://${match[1]}.supabase.co`;
      }
    }
    return parsed.origin;
  } catch {
    return cleaned;
  }
}

function normalizeAnonKey(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/^["']|["']$/g, '');
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const supabaseAnonKey = normalizeAnonKey(
  import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
);

const AUTH_STORAGE_KEY = 'retafit-supabase-auth';
const IDB_NAME = 'retafit-auth-db';
const IDB_STORE = 'auth_kv';
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365; // 1 año

function openAuthIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openAuthIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openAuthIdb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbRemove(key: string): Promise<void> {
  const db = await openAuthIdb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function cookieSet(key: string, value: string) {
  if (typeof document === 'undefined') return;
  try {
    const encoded = encodeURIComponent(value);
    const chunkSize = 3500;
    const chunks = Math.ceil(encoded.length / chunkSize);
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const cookieAttrs = isHttps
      ? `Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=None; Secure`
      : `Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
    const clearAttrs = isHttps
      ? 'Path=/; Max-Age=0; SameSite=None; Secure'
      : 'Path=/; Max-Age=0; SameSite=Lax';
    for (let i = 0; i < 6; i++) {
      document.cookie = `${key}_c${i}=; ${clearAttrs}`;
    }
    document.cookie = `${key}_chunks=${chunks}; ${cookieAttrs}`;
    for (let i = 0; i < chunks; i++) {
      const slice = encoded.slice(i * chunkSize, (i + 1) * chunkSize);
      document.cookie = `${key}_c${i}=${slice}; ${cookieAttrs}`;
    }
  } catch {
    // Ignore cookie errors
  }
}

function cookieGet(key: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const map = new Map<string, string>();
    document.cookie.split(';').forEach((part) => {
      const eq = part.indexOf('=');
      if (eq > 0) {
        map.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
      }
    });
    const chunksCount = Number(map.get(`${key}_chunks`) ?? '0');
    if (!chunksCount || Number.isNaN(chunksCount)) return null;
    let combined = '';
    for (let i = 0; i < chunksCount; i++) {
      const part = map.get(`${key}_c${i}`);
      if (!part) return null;
      combined += part;
    }
    return decodeURIComponent(combined);
  } catch {
    return null;
  }
}

function cookieRemove(key: string) {
  if (typeof document === 'undefined') return;
  try {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const clearAttrs = isHttps
      ? 'Path=/; Max-Age=0; SameSite=None; Secure'
      : 'Path=/; Max-Age=0; SameSite=Lax';
    document.cookie = `${key}_chunks=; ${clearAttrs}`;
    for (let i = 0; i < 6; i++) {
      document.cookie = `${key}_c${i}=; ${clearAttrs}`;
    }
  } catch {
    // Ignore
  }
}

const AUTH_CACHE_NAME = 'retafit-auth-cache-v1';

async function cacheSet(key: string, value: string): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(AUTH_CACHE_NAME);
    await cache.put(
      `/${encodeURIComponent(key)}`,
      new Response(value, { headers: { 'Content-Type': 'application/json' } })
    );
  } catch {
    // Ignore
  }
}

async function cacheGet(key: string): Promise<string | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(AUTH_CACHE_NAME);
    const res = await cache.match(`/${encodeURIComponent(key)}`);
    if (!res) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function cacheRemove(key: string): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(AUTH_CACHE_NAME);
    await cache.delete(`/${encodeURIComponent(key)}`);
  } catch {
    // Ignore
  }
}

const resilientAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const ls = window.localStorage.getItem(key);
      if (ls) return ls;
      // Migrate legacy Supabase default key if present
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && /^sb-.*-auth-token$/.test(k)) {
          const legacyVal = window.localStorage.getItem(k);
          if (legacyVal) {
            await resilientAuthStorage.setItem(key, legacyVal);
            return legacyVal;
          }
        }
      }
    } catch {
      // localStorage blocked or unavailable
    }

    const fromIdb = await idbGet(key);
    if (fromIdb) {
      try {
        window.localStorage.setItem(key, fromIdb);
      } catch {
        // Ignore
      }
      return fromIdb;
    }

    const fromCache = await cacheGet(key);
    if (fromCache) {
      try {
        window.localStorage.setItem(key, fromCache);
      } catch {
        // Ignore
      }
      await idbSet(key, fromCache);
      return fromCache;
    }

    const fromCookie = cookieGet(key);
    if (fromCookie) {
      try {
        window.localStorage.setItem(key, fromCookie);
      } catch {
        // Ignore
      }
      await idbSet(key, fromCookie);
      await cacheSet(key, fromCookie);
      return fromCookie;
    }

    return null;
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore
    }
    await Promise.all([idbSet(key, value), cacheSet(key, value)]);
    cookieSet(key, value);
    try {
      if (navigator.storage?.persist) {
        void navigator.storage.persist();
      }
    } catch {
      // Ignore
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
    await Promise.all([idbRemove(key), cacheRemove(key)]);
    cookieRemove(key);
  },
};

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    supabaseAnonKey.length > 20
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storageKey: AUTH_STORAGE_KEY,
        storage: resilientAuthStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export interface CloudUserData {
  profile: UserProfile;
  dailyLogs: DailyLog[];
  medicationLogs: MedicationLog[];
}

export async function fetchUserCloudData(user: User): Promise<CloudUserData> {
  if (!supabase) {
    throw new Error('Supabase no está configurado.');
  }

  const [profileRes, logsRes, medsRes] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('log_date', { ascending: true }),
    supabase
      .from('medication_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('med_date', { ascending: true }),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (logsRes.error) throw logsRes.error;
  if (medsRes.error) throw medsRes.error;

  let profile: UserProfile = { ...DEFAULT_PROFILE };
  if (profileRes.data) {
    const row = profileRes.data;
    profile = {
      sex: row.sex === 'female' ? 'female' : 'male',
      age: Number(row.age ?? DEFAULT_PROFILE.age),
      heightCm: Number(row.height_cm ?? DEFAULT_PROFILE.heightCm),
      referenceWeightKg: Number(row.reference_weight_kg ?? DEFAULT_PROFILE.referenceWeightKg),
      targetLossKg: Number(row.target_loss_kg ?? DEFAULT_PROFILE.targetLossKg),
      targetCalories: Number(row.target_calories ?? DEFAULT_PROFILE.targetCalories),
      targetProteinG: Number(row.target_protein_g ?? DEFAULT_PROFILE.targetProteinG),
      targetFatG: Number(row.target_fat_g ?? DEFAULT_PROFILE.targetFatG),
      targetCarbsG: Number(row.target_carbs_g ?? DEFAULT_PROFILE.targetCarbsG),
      estimatedTdee: Number(row.estimated_tdee ?? DEFAULT_PROFILE.estimatedTdee),
      habitualActivityNote: row.habitual_activity_note ?? DEFAULT_PROFILE.habitualActivityNote,
      lastBackupAt: row.last_backup_at ?? null,
    };
  } else {
    // Initialize profile row in Supabase on first authenticated session
    await upsertUserProfileCloud(user.id, profile);
  }

  const dailyLogs: DailyLog[] = (logsRes.data ?? []).map((r) => ({
    id: r.id,
    date: r.log_date,
    weightKg: r.weight_kg !== null ? Number(r.weight_kg) : null,
    calories: r.calories !== null ? Number(r.calories) : null,
    proteinG: r.protein_g !== null ? Number(r.protein_g) : null,
    carbsG: r.carbs_g !== null ? Number(r.carbs_g) : null,
    fatG: r.fat_g !== null ? Number(r.fat_g) : null,
    activeCalories: r.active_calories !== null ? Number(r.active_calories) : null,
    steps: r.steps !== null ? Number(r.steps) : null,
    exerciseType: r.exercise_type ?? null,
    exerciseDurationMin: r.exercise_duration_min !== null ? Number(r.exercise_duration_min) : null,
    notes: r.notes ?? null,
    updatedAt: r.updated_at,
  }));

  const medicationLogs: MedicationLog[] = (medsRes.data ?? []).map((r) => ({
    id: r.id,
    date: r.med_date,
    medName: r.med_name,
    volumeMl: Number(r.volume_ml),
    concentrationMgMl: r.concentration_mg_ml !== null ? Number(r.concentration_mg_ml) : null,
    notes: r.notes ?? null,
    updatedAt: r.updated_at,
  }));

  return { profile, dailyLogs, medicationLogs };
}

export async function upsertUserProfileCloud(userId: string, profile: UserProfile): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('user_profiles').upsert({
    id: userId,
    sex: profile.sex,
    age: profile.age,
    height_cm: profile.heightCm,
    reference_weight_kg: profile.referenceWeightKg,
    target_loss_kg: profile.targetLossKg,
    target_calories: profile.targetCalories,
    target_protein_g: profile.targetProteinG,
    target_fat_g: profile.targetFatG,
    target_carbs_g: profile.targetCarbsG,
    estimated_tdee: profile.estimatedTdee,
    habitual_activity_note: profile.habitualActivityNote,
    last_backup_at: profile.lastBackupAt,
  });
  if (error) throw error;
}

export async function upsertDailyLogCloud(userId: string, log: DailyLog): Promise<DailyLog> {
  if (!supabase) return log;
  const { data, error } = await supabase
    .from('daily_logs')
    .upsert(
      {
        user_id: userId,
        log_date: log.date,
        weight_kg: log.weightKg,
        calories: log.calories,
        protein_g: log.proteinG,
        carbs_g: log.carbsG,
        fat_g: log.fatG,
        active_calories: log.activeCalories,
        steps: log.steps,
        exercise_type: log.exerciseType,
        exercise_duration_min: log.exerciseDurationMin,
        notes: log.notes,
      },
      { onConflict: 'user_id,log_date' }
    )
    .select()
    .single();

  if (error) throw error;
  return {
    ...log,
    id: data.id,
    updatedAt: data.updated_at,
  };
}

export async function deleteDailyLogCloud(userId: string, date: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('daily_logs')
    .delete()
    .eq('user_id', userId)
    .eq('log_date', date);
  if (error) throw error;
}

export async function upsertMedicationLogCloud(
  userId: string,
  med: MedicationLog
): Promise<MedicationLog> {
  if (!supabase) return med;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(med.id);

  const payload = {
    ...(isUuid ? { id: med.id } : {}),
    user_id: userId,
    med_date: med.date,
    med_name: med.medName,
    volume_ml: med.volumeMl,
    concentration_mg_ml: med.concentrationMgMl,
    notes: med.notes,
  };

  const { data, error } = await supabase
    .from('medication_logs')
    .upsert(payload)
    .select()
    .single();

  if (error) throw error;
  return {
    ...med,
    id: data.id,
    updatedAt: data.updated_at,
  };
}

export async function deleteMedicationLogCloud(userId: string, id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('medication_logs')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}

export async function batchUpsertDailyLogsCloud(userId: string, logs: DailyLog[]): Promise<void> {
  if (!supabase || logs.length === 0) return;
  const rows = logs.map((log) => ({
    user_id: userId,
    log_date: log.date,
    weight_kg: log.weightKg,
    calories: log.calories,
    protein_g: log.proteinG,
    carbs_g: log.carbsG,
    fat_g: log.fatG,
    active_calories: log.activeCalories,
    steps: log.steps,
    exercise_type: log.exerciseType,
    exercise_duration_min: log.exerciseDurationMin,
    notes: log.notes,
  }));
  const { error } = await supabase
    .from('daily_logs')
    .upsert(rows, { onConflict: 'user_id,log_date' });
  if (error) throw error;
}

export async function batchInsertMedicationLogsCloud(
  userId: string,
  meds: MedicationLog[]
): Promise<void> {
  if (!supabase || meds.length === 0) return;
  const rows = meds.map((m) => ({
    user_id: userId,
    med_date: m.date,
    med_name: m.medName,
    volume_ml: m.volumeMl,
    concentration_mg_ml: m.concentrationMgMl,
    notes: m.notes,
  }));
  const { error } = await supabase.from('medication_logs').insert(rows);
  if (error) throw error;
}

export async function clearAllUserDataCloud(userId: string): Promise<void> {
  if (!supabase) return;
  const [d1, d2] = await Promise.all([
    supabase.from('daily_logs').delete().eq('user_id', userId),
    supabase.from('medication_logs').delete().eq('user_id', userId),
  ]);
  if (d1.error) throw d1.error;
  if (d2.error) throw d2.error;
}
