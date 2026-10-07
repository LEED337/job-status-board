export const STATUSES = [
  "Applied",
  "Haven't heard back",
  "Interviewing",
  "Not hired",
] as const;

export type ApplicationStatus = (typeof STATUSES)[number];

export type Interview = {
  id: string;
  at: string;
  kind: string;
};

export type Application = {
  id: string;
  company: string;
  role: string;
  jobUrl?: string;
  status: ApplicationStatus;
  appliedOn: string;
  location: string;
  notes?: string;
  interviews: Interview[];
};

export type BoardFile = {
  version: 1;
  owner: string;
  updatedAt: string;
  applications: Application[];
};

export const INTERVIEW_KINDS = [
  "Recruiter screen",
  "Hiring manager",
  "Portfolio review",
  "Technical conversation",
  "Panel",
  "Onsite",
  "Final round",
] as const;
