import type { ReactNode, SVGProps } from "react";

/**
 * Icon set ported from prototype/index.html.
 * Rules (DESIGN_SYSTEM.md): 1.5px stroke, round caps. Stacked cards = Flashcards; crossing arrows = Shuffle only.
 * The three end-mode icons are loop, stop (unlettered outlined octagon, never pause bars) and next.
 */
const ICONS = {
  loop: {
    label: "Loop Verse",
    body: (
      <>
        <path d="M17 2l3 3-3 3" />
        <path d="M4 11V9a4 4 0 0 1 4-4h12" />
        <path d="M7 22l-3-3 3-3" />
        <path d="M20 13v2a4 4 0 0 1-4 4H4" />
      </>
    ),
  },
  stop: {
    label: "Stop After Verse",
    body: <polygon points="8.4,3 15.6,3 21,8.4 21,15.6 15.6,21 8.4,21 3,15.6 3,8.4" />,
  },
  next: {
    label: "Next Verse",
    body: (
      <>
        <path d="M4 18v-2a6 6 0 0 1 6-6h10" />
        <path d="M16 5.5l4 4.5-4 4.5" />
      </>
    ),
  },
  play: { label: "Play", filled: true, body: <path d="M7 4.5v15l13-7.5z" /> },
  pause: {
    label: "Pause",
    filled: true,
    body: (
      <>
        <rect x="6" y="5" width="4" height="14" rx="1" />
        <rect x="14" y="5" width="4" height="14" rx="1" />
      </>
    ),
  },
  note: {
    label: "Music",
    body: (
      <>
        <path d="M9 18V5l11-2v13" />
        <circle cx="6.5" cy="18" r="2.5" />
        <circle cx="17.5" cy="16" r="2.5" />
      </>
    ),
  },
  skipBack: {
    label: "Previous verse",
    body: (
      <>
        <path d="M6 5v14" />
        <path d="M19 5v14L8 12z" fill="currentColor" />
      </>
    ),
  },
  skipForward: {
    label: "Next verse",
    body: (
      <>
        <path d="M18 5v14" />
        <path d="M5 5v14l11-7z" fill="currentColor" />
      </>
    ),
  },
  chevronLeft: { label: "Back", body: <path d="M15 5l-7 7 7 7" /> },
  chevronRight: { label: "Forward", body: <path d="M9 5l7 7-7 7" /> },
  triangleLeft: {
    label: "Previous",
    body: <path d="M16 5v14L6 12z" fill="currentColor" stroke="none" />,
  },
  triangleRight: {
    label: "Next",
    body: <path d="M8 5v14l10-7z" fill="currentColor" stroke="none" />,
  },
  cards: {
    label: "Flashcards",
    body: (
      <>
        <rect x="8" y="3.5" width="12" height="15" rx="2" />
        <path d="M5.5 7.2A2 2 0 0 0 4 9.1v9.4a2 2 0 0 0 2 2h8.4a2 2 0 0 0 1.9-1.5" />
        <path d="M11 8.5h6M11 12h4" />
      </>
    ),
  },
  shuffle: {
    label: "Shuffle",
    body: (
      <>
        <path d="M3 7h3c3 0 5 2 7 5s4 5 7 5h1" />
        <path d="M3 17h3c1.5 0 2.7-.6 3.8-1.6" />
        <path d="M13 8c1-1 2.2-2 4-2h3" />
        <path d="M18 3l3 3-3 3" />
        <path d="M18 14l3 3-3 3" />
      </>
    ),
  },
  help: {
    label: "Help",
    viewBox: "5.5 3.5 13 17",
    body: (
      <>
        <path d="M9.2 9.3a2.9 2.9 0 0 1 5.6.9c0 1.9-2.8 2.3-2.8 4.3" />
        <circle cx="12" cy="17.6" r=".6" fill="currentColor" />
      </>
    ),
  },
  list: {
    label: "Steps",
    body: (
      <>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <circle cx="4.5" cy="6" r="1" />
        <circle cx="4.5" cy="12" r="1" />
        <circle cx="4.5" cy="18" r="1" />
      </>
    ),
  },
  eye: {
    label: "Reveal",
    body: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  book: {
    label: "Scripture",
    body: (
      <>
        <path d="M12 6C10 4.5 7 4 3 4v14c4 0 7 .5 9 2 2-1.5 5-2 9-2V4c-4 0-7 .5-9 2z" />
        <path d="M12 6v14" />
      </>
    ),
  },
  settings: {
    label: "Settings",
    body: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
      </>
    ),
  },
} satisfies Record<string, { label: string; body: ReactNode; viewBox?: string; filled?: boolean }>;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** The three playback-end modes, in menu order. */
export const END_MODES = [
  { id: "loop", label: "Loop Verse" },
  { id: "stop", label: "Stop After Verse" },
  { id: "next", label: "Next Verse" },
] as const satisfies readonly { id: IconName; label: string }[];

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  name: IconName;
  size?: number;
  /** Accessible name. Omit for decorative icons next to a text label. */
  title?: string;
};

export function Icon({ name, size = 24, title, ...rest }: IconProps) {
  const icon: { label: string; body: ReactNode; viewBox?: string; filled?: boolean } = ICONS[name];
  return (
    <svg
      viewBox={icon.viewBox ?? "0 0 24 24"}
      width={size}
      height={size}
      fill={icon.filled ? "currentColor" : "none"}
      stroke={icon.filled ? "none" : "currentColor"}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {icon.body}
    </svg>
  );
}
