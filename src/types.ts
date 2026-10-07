export {
  STATUSES,
  type Application,
  type ApplicationStatus,
  type BoardFile,
  type Interview,
} from "../api/_lib/boardFile.ts";

export const INTERVIEW_KINDS = [
  "Recruiter screen",
  "Hiring manager",
  "Portfolio review",
  "Technical conversation",
  "Panel",
  "Onsite",
  "Final round",
] as const;
