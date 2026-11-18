import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#B7FF00] text-black font-semibold text-sm hover:bg-[#c8ff33] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4" />
        <span>{compact ? 'Instalar' : 'Instalar App'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#191F19] border border-[#B7FF00]/30 text-[#B7FF00] font-medium text-xs hover:bg-[#232b23] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="w-4 h-4" />
          <span>Instalar en iPhone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#191F19] border border-[#2c352c] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg font-bold text-white">Instalar RETAFIT en iPhone</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#A0A0A0] hover:text-white hover:bg-black/40 cursor-pointer"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="space-y-3 text-sm text-[#A0A0A0]">
                <li className="flex items-start gap-3">
                  <span className="font-mono text-[#B7FF00] font-bold">1.</span>
                  <span>
                    Pulsa el botón <strong className="text-white inline-flex items-center gap-1">Compartir <Share className="w-3.5 h-3.5 inline text-[#B7FF00]" /></strong> en la barra inferior de Safari.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="font-mono text-[#B7FF00] font-bold">2.</span>
                  <span>
                    Desliza hacia abajo y selecciona <strong className="text-white">Añadir a pantalla de inicio</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="font-mono text-[#B7FF00] font-bold">3.</span>
                  <span>
                    Pulsa <strong className="text-white">Añadir</strong> para usar RETAFIT como app independiente con icono propio.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full min-h-[44px] rounded-xl bg-[#B7FF00] text-black font-semibold text-sm hover:bg-[#c8ff33] transition-colors cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-[#191F19] border border-amber-400/40 px-3.5 py-2 text-xs font-medium text-amber-300 shadow-lg">
      <span>Sin conexión a internet · Modo lectura en caché</span>
    </div>
  );
};
