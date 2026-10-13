import type { ReactElement } from 'react';

/**
 * Inline stroke icons. Neither web font contains → or ↗, so every
 * directional glyph is drawn rather than typed.
 */
const paths = {
  'arrow-right': <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" />,
  'arrow-down': <path d="M8 2.5v11M3.5 9 8 13.5 12.5 9" />,
  'arrow-up': <path d="M8 13.5v-11M3.5 7 8 2.5 12.5 7" />,
  'arrow-out': <path d="M4.5 11.5l7-7M5.5 4.5h6v6" />,
  copy: (
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
    </>
  ),
  check: <path d="M3 8.5 6.5 12 13 4.5" />,
  play: <path d="M5 3.25v9.5L12.5 8z" fill="currentColor" />,
  pause: <path d="M5.5 3.5v9M10.5 3.5v9" />,
  reset: <path d="M3.2 8a4.8 4.8 0 1 0 1.4-3.4M3.2 2.6v2.8H6" />,
  step: <path d="M3.5 3.5v9L9.5 8zM12.5 3.5v9" />,
  menu: <path d="M2.5 5.5h11M2.5 10.5h11" />,
  close: <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />,
  mail: (
    <>
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="m2.5 4.5 5.5 4.5 5.5-4.5" />
    </>
  ),
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof paths;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
