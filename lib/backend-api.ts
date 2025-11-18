const DEFAULT_API_BASE = "";

const resolveApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      const port = process.env.NEXT_PUBLIC_API_PORT ?? "8000";
      const resolved = `${protocol}//${hostname}:${port}`;
      if (!(window as typeof window & { __owhLoggedBase?: boolean }).__owhLoggedBase) {
        console.info(`[OWH] Using API base: ${resolved}`);
        (window as typeof window & { __owhLoggedBase?: boolean }).__owhLoggedBase = true;
      }
      return resolved;
    }
    return "";
  }
  return process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE;
};

type FetchOptions = RequestInit & { token?: string };

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const baseUrl = resolveApiBase();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail = data?.detail ?? response.statusText;
    throw new Error(Array.isArray(detail) ? detail.join(", ") : detail);
  }

  return data as T;
}

export async function requestVerification(email: string): Promise<string> {
  const { message } = await apiFetch<{ message: string }>("/verification/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  return message;
}

export interface VerificationConfirmResponse {
  affiliation_token: string;
  expires_at: string;
}

export async function confirmVerification(code: string): Promise<VerificationConfirmResponse> {
  return apiFetch<VerificationConfirmResponse>("/verification/confirm", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export type StaffGroup = "group_a" | "group_b" | "group_c";

export interface ReportPayload {
  shift_date: string;
  actual_hours_worked: number;
  overtime_hours: number;
  staff_group: StaffGroup;
  notes?: string;
}

export async function submitReport(payload: ReportPayload, token: string): Promise<void> {
  await apiFetch("/reports/", {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}

export interface HospitalMonthlySummary {
  hospital_domain: string;
  staff_group: StaffGroup;
  month_start: string;
  report_count: number;
  average_actual_hours: number | null;
  average_overtime_hours: number | null;
  total_actual_hours: number | null;
  total_overtime_hours: number | null;
  ci_actual_low: number | null;
  ci_actual_high: number | null;
  ci_overtime_low: number | null;
  ci_overtime_high: number | null;
  suppressed: boolean;
}

export interface StaffGroupMonthlySummary {
  staff_group: StaffGroup;
  month_start: string;
  report_count: number;
  average_actual_hours: number | null;
  average_overtime_hours: number | null;
  total_actual_hours: number | null;
  total_overtime_hours: number | null;
  ci_actual_low: number | null;
  ci_actual_high: number | null;
  ci_overtime_low: number | null;
  ci_overtime_high: number | null;
  suppressed: boolean;
}

export interface AnalyticsResponse {
  hospital_monthly: HospitalMonthlySummary[];
  staff_group_monthly: StaffGroupMonthlySummary[];
}

interface FetchAnalyticsOptions {
  months?: number;
  staffGroup?: StaffGroup;
}

export async function fetchAnalytics(options: FetchAnalyticsOptions = {}): Promise<AnalyticsResponse> {
  const { months = 6, staffGroup } = options;
  const params = new URLSearchParams({ months: String(months) });
  if (staffGroup) {
    params.set("staff_group", staffGroup);
  }
  return apiFetch<AnalyticsResponse>(`/analytics/?${params.toString()}`);
}
