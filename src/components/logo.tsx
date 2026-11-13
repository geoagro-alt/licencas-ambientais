/** Logo: folha com "check" (licença em dia) sobre fundo verde. Mesmo desenho de src/app/icon.svg. */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Licenças Ambientais">
      <defs>
        <linearGradient id="logo-gradiente" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#059669" />
          <stop offset="1" stopColor="#065f46" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#logo-gradiente)" />
      <path d="M14 50 C14 28 28 14 52 13 C51 36 37 50 14 50 Z" fill="#fff" />
      <path d="M14 50 L27 37" stroke="#065f46" strokeWidth="2.5" strokeLinecap="round" opacity=".35" />
      <path d="M24.5 33.5 L30.5 39.5 L42 25.5" fill="none" stroke="#047857" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
