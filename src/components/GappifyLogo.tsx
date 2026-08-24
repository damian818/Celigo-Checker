import React from 'react';

interface GappifyLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const GappifyLogo: React.FC<GappifyLogoProps> = ({ 
  className = '', 
  size = 36,
  showText = false 
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* SVG Shield Emblem */}
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 512 512" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-[0_0_12px_rgba(56,189,248,0.35)]"
      >
        <defs>
          <linearGradient id="gLogoShield" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="50%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
          <linearGradient id="gLogoBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0B1220" />
            <stop offset="100%" stopColor="#050B14" />
          </linearGradient>
          <linearGradient id="gLoopL" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <linearGradient id="gLoopR" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
          <linearGradient id="gCheck" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ADE80" />
            <stop offset="100%" stopColor="#22C55E" />
          </linearGradient>
        </defs>

        {/* Shield background */}
        <path 
          d="M 256 70 C 316 95 385 105 410 120 C 410 260 370 365 256 442 C 142 365 102 260 102 120 C 127 105 196 95 256 70 Z" 
          fill="url(#gLogoBg)" 
          stroke="url(#gLogoShield)" 
          strokeWidth="16" 
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Infinity Loops */}
        <circle cx="210" cy="256" r="62" fill="none" stroke="url(#gLoopL)" strokeWidth="26" strokeLinecap="round" />
        <circle cx="302" cy="256" r="62" fill="none" stroke="url(#gLoopR)" strokeWidth="26" strokeLinecap="round" />

        {/* Center Alert Dot */}
        <circle cx="256" cy="226" r="13" fill="#F87171" stroke="#0B1220" strokeWidth="4" />

        {/* Remediation Checkmark */}
        <path 
          d="M 226 260 L 250 286 L 298 228" 
          fill="none" 
          stroke="url(#gCheck)" 
          strokeWidth="22" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
      </svg>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white">Gappify</span>
            <div className="h-4 w-[1px] bg-slate-700 mx-0.5"></div>
            <span className="text-xs font-bold text-sky-400 tracking-wide">Celigo Remediation Hub</span>
          </div>
        </div>
      )}
    </div>
  );
};
