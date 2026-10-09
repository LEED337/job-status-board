import type { ApplicationStatus } from "../types.ts";

/**
 * Shared status colors. Badges use a soft fill with `text` on top. Chart rings
 * use the same soft fill. Dots use `text`. `onDark` is that text color lifted
 * just enough to clear WCAG AA on the chart's #10101a center.
 */
export const STATUS_META: Record<
  ApplicationStatus,
  { soft: string; text: string; onDark: string; caption: string }
> = {
  Applied: {
    soft: "#e7edfb",
    text: "#3451c7",
    onDark: "#657bd4",
    caption: "Waiting to hear back",
  },
  Interviewing: {
    soft: "#e3f5eb",
    text: "#15724a",
    onDark: "#448e6e",
    caption: "Active conversations",
  },
  "Not hired": {
    soft: "#f8e9ec",
    text: "#9d4454",
    onDark: "#b26d79",
    caption: "Closed",
  },
};

export const AVATAR_COLORS = [
  { bg: "#e7eefc", fg: "#2a4494" },
  { bg: "#e5f5ec", fg: "#176b42" },
  { bg: "#f8eaed", fg: "#8d3a48" },
  { bg: "#f6efe4", fg: "#7a5520" },
  { bg: "#f0eaf8", fg: "#5b3d86" },
  { bg: "#e6f4f4", fg: "#1d5c5c" },
  { bg: "#fdeee4", fg: "#8a4b22" },
];
