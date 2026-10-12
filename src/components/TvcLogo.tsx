import React from 'react';

const tvcLogoImage = '/images/tvc_official_logo_1791476174683.jpg';

interface TvcLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'badge' | 'minimal' | 'full';
}

const SIZE_MAP = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

export const TvcLogo: React.FC<TvcLogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
  variant = 'badge',
}) => {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Official Emblem Badge */}
      <div
        className={`${sizeClass} relative rounded-full overflow-hidden shadow-xs shrink-0 bg-zinc-950 border border-zinc-200/50 flex items-center justify-center group`}
      >
        <img
          src={tvcLogoImage}
          alt="The Venture Club Official Emblem"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          referrerPolicy="no-referrer"
          onError={(e) => {
            // High-res SVG Fallback if image path is unavailable
            const target = e.currentTarget;
            target.style.display = 'none';
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }}
        />

        {/* Scalable Vector Fallback */}
        <div
          className="w-full h-full absolute inset-0 items-center justify-center bg-zinc-950 hidden"
          style={{ display: 'none' }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="#FFFFFF" stroke="#001845" strokeWidth="4" />
            <circle cx="50" cy="50" r="41" fill="none" stroke="#FDB813" strokeWidth="2.5" strokeDasharray="4 2" />
            {/* T */}
            <path d="M22 34 H44 M33 34 V64" stroke="#001845" strokeWidth="6" strokeLinecap="round" />
            {/* V */}
            <path d="M42 34 L52 64 L62 34" fill="none" stroke="#FDB813" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            {/* C */}
            <path d="M80 38 C75 30 63 30 58 46 C55 56 63 68 76 65" fill="none" stroke="#0056D2" strokeWidth="6" strokeLinecap="round" />
            {/* Banner */}
            <rect x="15" y="68" width="70" height="16" rx="4" fill="#001845" />
            <text x="50" y="80" textAnchor="middle" fill="#FFFFFF" fontSize="7.5" fontWeight="900" fontFamily="sans-serif">
              THE VENTURE CLUB
            </text>
          </svg>
        </div>
      </div>

      {showText && (
        <div className="leading-tight min-w-0">
          <div className="text-sm sm:text-lg font-bold font-sans tracking-tight text-zinc-950 truncate">
            The Venture Club
          </div>
          <div className="text-[9px] sm:text-[10px] font-mono tracking-wider uppercase text-blue-700 font-semibold truncate">
            Ideate · Innovate · Impact
          </div>
        </div>
      )}
    </div>
  );
};
