import React, { useState } from 'react';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RetafitLogo } from './RetafitLogo';

interface AuthScreenProps {
  onClose?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onClose }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (onClose) onClose();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          if (onClose) onClose();
        } else {
          setInfoMsg(
            'Cuenta creada. Revisa tu correo electrónico para confirmar el registro e iniciar sesión.'
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de autenticación.';
      const lower = msg.toLowerCase();
      if (lower.includes('invalid path specified in request url')) {
        setErrorMsg(
          'La variable VITE_SUPABASE_URL tiene una ruta incorrecta. Debe ser exactamente la Project URL base: https://tu-id.supabase.co (sin /rest/v1 ni barras finales).'
        );
      } else if (lower.includes('already registered')) {
        setMode('login');
        setInfoMsg('Ese email ya tiene una cuenta creada. Pulsa "Entrar en RETAFIT" para iniciar sesión.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#191F19] border border-[#2d382d] p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <RetafitLogo size="lg" />
          <p className="text-xs text-[#A0A0A0] max-w-xs">
            Acceso privado sincronizado entre tu iPhone y Mac mediante Supabase y Row Level Security.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#080B08] border border-[#263026]">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              mode === 'login' ? 'bg-[#B7FF00] text-black' : 'text-[#A0A0A0] hover:text-white'
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              mode === 'signup' ? 'bg-[#B7FF00] text-black' : 'text-[#A0A0A0] hover:text-white'
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#A0A0A0]">Email</span>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#A0A0A0] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full min-h-[46px] pl-10 pr-4 rounded-xl bg-[#080B08] border border-[#2c362c] text-sm text-white focus:outline-none focus:border-[#B7FF00]"
              />
            </div>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#A0A0A0]">Contraseña</span>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#A0A0A0] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                name="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full min-h-[46px] pl-10 pr-4 rounded-xl bg-[#080B08] border border-[#2c362c] text-sm text-white focus:outline-none focus:border-[#B7FF00]"
              />
            </div>
          </label>

          {errorMsg && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl p-3">
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div className="text-xs text-[#B7FF00] bg-[#B7FF00]/10 border border-[#B7FF00]/30 rounded-xl p-3">
              {infoMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] rounded-xl bg-[#B7FF00] text-black font-bold text-sm hover:bg-[#c8ff33] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>
              {loading
                ? 'Conectando...'
                : mode === 'login'
                ? 'Entrar en RETAFIT'
                : 'Registrar cuenta'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
