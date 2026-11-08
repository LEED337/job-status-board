type IconProps = { className?: string };

export function SearchIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="5.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13.2 13.2 16.5 16.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M8 5.5 12.5 10 8 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CalendarIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3.25" y="4.25" width="13.5" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.25 8.25h13.5M7 3v2.5M13 3v2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SunIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <rect x="10.7" y="1.05" width="2.6" height="3.85" rx="1.3" />
      <rect x="10.7" y="1.05" width="2.6" height="3.85" rx="1.3" transform="rotate(45 12 12)" />
      <rect x="10.7" y="1.05" width="2.6" height="3.85" rx="1.3" transform="rotate(90 12 12)" />
      <rect x="10.7" y="1.05" width="2.6" height="3.85" rx="1.3" transform="rotate(135 12 12)" />
      <rect x="10.7" y="1.05" width="2.6" height="3.85" rx="1.3" transform="rotate(180 12 12)" />
      <rect x="10.7" y="1.05" width="2.6" height="3.85" rx="1.3" transform="rotate(225 12 12)" />
      <rect x="10.7" y="1.05" width="2.6" height="3.85" rx="1.3" transform="rotate(270 12 12)" />
      <rect x="10.7" y="1.05" width="2.6" height="3.85" rx="1.3" transform="rotate(315 12 12)" />
    </svg>
  );
}

export function MoonIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
