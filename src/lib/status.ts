import type { ApplicationStatus } from "../types.ts";

export const STATUS_META: Record<
  ApplicationStatus,
  { color: string; bar: string; soft: string; caption: string }
> = {
  Applied: {
    color: "#3451c7",
    bar: "#1d4ed8",
    soft: "#e7edfb",
    caption: "Waiting to hear back",
  },
  Interviewing: {
    color: "#15724a",
    bar: "#0e9f4f",
    soft: "#e3f5eb",
    caption: "Active conversations",
  },
  "Not hired": {
    color: "#9d4454",
    bar: "#e11d2e",
    soft: "#f8e9ec",
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
