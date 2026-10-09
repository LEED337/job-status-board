import type { ApplicationStatus } from "../types.ts";

/**
 * One color per status. The summary chart (segments and legend dots) and the
 * status badges all read this value so they cannot drift apart.
 *
 * Interviewing started as the chart green #0e9f4f. White badge text on that
 * green is about 3.4:1, under WCAG AA for small text, so it is darkened just
 * enough to clear 4.5:1. Applied (#1d4ed8, ~6.7:1) and Not hired (#e11d2e, ~4.8:1)
 * already pass and stay as they were.
 */
export const STATUS_META: Record<ApplicationStatus, { color: string; caption: string }> = {
  Applied: {
    color: "#1d4ed8",
    caption: "Waiting to hear back",
  },
  Interviewing: {
    color: "#0c8642",
    caption: "Active conversations",
  },
  "Not hired": {
    color: "#e11d2e",
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
