import type { ApplicationStatus } from "../types.ts";

/**
 * Shared status colors. Badges use a soft fill with `text` on top. Chart rings
 * use the same soft fill. Dots use `text`. `onDark` is that text color lifted
 * just enough to clear WCAG AA on the chart's #10101a center.
 */
export const STATUS_META: Record<
  ApplicationStatus,
  { soft: string; chip: string; text: string; onDark: string; caption: string }
> = {
  Applied: {
    soft: "#e7edfb",
    chip: "var(--chip-applied-bg)",
    text: "var(--chip-applied-fg)",
    onDark: "#657bd4",
    caption: "Waiting to hear back",
  },
  Interviewing: {
    soft: "#e3f5eb",
    chip: "var(--chip-interview-bg)",
    text: "var(--chip-interview-fg)",
    onDark: "#448e6e",
    caption: "Active conversations",
  },
  "Not hired": {
    soft: "#f8e9ec",
    chip: "var(--chip-closed-bg)",
    text: "var(--chip-closed-fg)",
    onDark: "#b26d79",
    caption: "Closed",
  },
  Ghosted: {
    soft: "#eeeef0",
    chip: "var(--chip-ghost-bg)",
    text: "var(--chip-ghost-fg)",
    onDark: "#808186",
    caption: "No reply after 30 days",
  },
};

export const AVATAR_COLORS = [
  { bg: "var(--avatar-1-bg)", fg: "var(--avatar-1-fg)" },
  { bg: "var(--avatar-2-bg)", fg: "var(--avatar-2-fg)" },
  { bg: "var(--avatar-3-bg)", fg: "var(--avatar-3-fg)" },
  { bg: "var(--avatar-4-bg)", fg: "var(--avatar-4-fg)" },
  { bg: "var(--avatar-5-bg)", fg: "var(--avatar-5-fg)" },
  { bg: "var(--avatar-6-bg)", fg: "var(--avatar-6-fg)" },
  { bg: "var(--avatar-7-bg)", fg: "var(--avatar-7-fg)" },
];
