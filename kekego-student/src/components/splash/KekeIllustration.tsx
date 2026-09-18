import { cn } from '../../utils/cn'

interface KekeIllustrationProps {
  className?: string
}

/**
 * Modern monochrome vector of a campus keke (auto-rickshaw), side-profile.
 * Drawn to match the dark charcoal splash background.
 */
export function KekeIllustration({ className }: KekeIllustrationProps) {
  return (
    <svg
      viewBox="0 0 320 250"
      role="img"
      aria-label="Campus shuttle (keke) illustration"
      className={cn('h-auto w-full max-w-xs', className)}
    >
      <defs>
        <linearGradient id="keke-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#8f96a0" />
        </linearGradient>
        <linearGradient id="keke-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#b4bac1" />
        </linearGradient>
        <linearGradient id="keke-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <radialGradient id="keke-wheel" cx="50%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="55%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#5b6470" />
        </radialGradient>
      </defs>

      {/* ground shadow + under-glow */}
      <ellipse cx="164" cy="222" rx="132" ry="13" fill="#000000" opacity="0.4" />
      <ellipse cx="158" cy="178" rx="126" ry="70" fill="#ffffff" opacity="0.05" />

      {/* rear wheels */}
      <g>
        <circle cx="92" cy="198" r="31" fill="url(#keke-wheel)" />
        <circle cx="92" cy="198" r="19" fill="#111827" />
        <circle cx="92" cy="198" r="8" fill="#cbd5e1" />
        <circle cx="92" cy="198" r="3" fill="#334155" />
        <path d="M92 178 L92 218 M72 198 L112 198" stroke="#475569" strokeWidth="2" />
      </g>

      {/* front wheel (steering) */}
      <g>
        <circle cx="230" cy="202" r="33" fill="url(#keke-wheel)" />
        <circle cx="230" cy="202" r="20" fill="#111827" />
        <circle cx="230" cy="202" r="9" fill="#cbd5e1" />
        <circle cx="230" cy="202" r="3" fill="#334155" />
        <path d="M230 178 L230 226 M206 202 L254 202" stroke="#94a3b8" strokeWidth="2" />
      </g>

      {/* body */}
      <path
        d="M46 168
           L268 168
           Q280 168 282 158
           L280 146
           Q279 138 270 138
           L246 116
           Q239 108 229 110
           L187 102
           Q178 99 172 107
           L158 108
           Q145 102 136 108
           L92 112
           Q56 116 52 140
           L47 164
           Q46 168 46 168 Z"
        fill="url(#keke-body)"
        stroke="#ffffff"
        strokeOpacity="0.25"
        strokeWidth="1.5"
      />

      {/* passenger window */}
      <rect x="68" y="120" width="78" height="24" rx="11" fill="url(#keke-glass)" opacity="0.92" />
      <path d="M72 124 L138 124" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.9" />

      {/* driver windshield */}
      <path
        d="M234 114 L266 138 L244 141 L224 118 Q224 114 234 114 Z"
        fill="url(#keke-glass)"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <path d="M232 122 L256 138" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.85" />

      {/* driver roof highlight */}
      <path
        d="M226 108 Q204 100 187 102 L186 102 Q203 100 226 108"
        fill="#f8fafc"
        opacity="0.95"
      />
      <path
        d="M158 108 Q136 112 96 112"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.7"
        fill="none"
      />

      {/* door seam + handle */}
      <path d="M162 112 L162 166" stroke="#5b6470" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="176" cy="150" r="3.5" fill="#ffffff" />

      {/* passenger bench line */}
      <path d="M70 150 L160 150" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" opacity="0.8" />

      {/* "X" emblem */}
      <g>
        <rect x="94" y="140" width="38" height="26" rx="8" fill="#0f172a" opacity="0.9" />
        <text
          x="113"
          y="159"
          textAnchor="middle"
          fontSize="16"
          fontWeight="800"
          fill="#ffffff"
          letterSpacing="0.5"
        >
          X
        </text>
      </g>

      {/* headlamp */}
      <circle cx="276" cy="150" r="9" fill="#ffffff" opacity="0.2" />
      <circle cx="276" cy="150" r="5.5" fill="#ffffff" />
      <circle cx="276" cy="150" r="2.4" fill="#cbd5e1" />

      {/* wing mirror */}
      <path d="M220 106 L214 98" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="212" cy="96" r="4" fill="#e2e8f0" stroke="#5b6470" strokeWidth="1.5" />

      {/* floor accent */}
      <path d="M48 170 L270 170" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.25" />
    </svg>
  )
}