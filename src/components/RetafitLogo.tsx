import React from 'react';

interface RetafitLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

export const RetafitLogo: React.FC<RetafitLogoProps> = ({
  size = 'md',
  showWordmark = true,
  className = '',
}) => {
  const iconDim = size === 'sm' ? 32 : size === 'lg' ? 52 : 40;

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <svg
        width={iconDim}
        height={iconDim}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Logotipo RETAFIT"
        className="shrink-0 drop-shadow-[0_0_10px_rgba(183,255,0,0.22)]"
      >
        <g transform="translate(32 32) rotate(-38) translate(-32 -32)">
          {/* Plunger flange */}
          <rect x="6" y="27" width="3" height="10" rx="1.2" fill="#B7FF00" />
          {/* Plunger rod */}
          <rect x="9" y="30" width="8" height="4" rx="1" fill="#B7FF00" />
          {/* Finger grip */}
          <rect x="17" y="23.5" width="3.2" height="17" rx="1.5" fill="#B7FF00" />
          {/* Syringe geometric barrel */}
          <rect
            x="20.2"
            y="25.5"
            width="23.8"
            height="13"
            rx="2.4"
            fill="#080B08"
            stroke="#B7FF00"
            strokeWidth="2.2"
          />
          {/* Measurement tick marks */}
          <line x1="25" y1="25.5" x2="25" y2="29" stroke="#B7FF00" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="29.5" y1="25.5" x2="29.5" y2="28" stroke="#B7FF00" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="34" y1="25.5" x2="34" y2="29" stroke="#B7FF00" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="38.5" y1="25.5" x2="38.5" y2="28" stroke="#B7FF00" strokeWidth="1.4" strokeLinecap="round" />
          {/* Integrated ascending progress trend line */}
          <path
            d="M23 35.5 L28.5 32.5 L33 34 L40 28.5"
            stroke="#B7FF00"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M36.8 28.3 L40.2 28.3 L40.1 31.7"
            stroke="#B7FF00"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Hub */}
          <path d="M44 28.5 L48.5 30 L48.5 34 L44 35.5 Z" fill="#B7FF00" />
          {/* Fine needle */}
          <line x1="48.5" y1="32" x2="58.5" y2="32" stroke="#B7FF00" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      </svg>

      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span
            className={`font-display font-extrabold tracking-tight text-white whitespace-nowrap ${
              size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-xl'
            }`}
          >
            RETA<span className="text-[#B7FF00]">FIT</span>
          </span>
          <span
            className={`font-mono uppercase tracking-[0.18em] text-[#A0A0A0] whitespace-nowrap mt-0.5 ${
              size === 'sm' ? 'text-[9px]' : size === 'lg' ? 'text-[11px]' : 'text-[10px]'
            }`}
          >
            TRACK YOUR PROGRESS
          </span>
        </div>
      )}
    </div>
  );
};
