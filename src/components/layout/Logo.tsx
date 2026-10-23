export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="18" fill="#42583c" />
      <path d="M32 14c-7 8-10.5 15-10.5 21a10.5 10.5 0 0 0 21 0C42.5 29 39 22 32 14Z" fill="#f3ecdd" />
      <path d="M32 26v20M32 36l-5-4M32 40l5-4" stroke="#6a8a5f" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={compact ? 28 : 34} />
      <span className={compact ? 'font-serif text-xl' : 'font-serif text-2xl'}>Ritual</span>
    </div>
  );
}
