"use client"

import { useAffiliationToken } from "@/hooks/useAffiliationToken"
import { ReportForm } from "@/components/report-form"
import { VerificationForm } from "@/components/verification-form"

export default function DataIngestionPage() {
  const { token, saveToken, clearToken } = useAffiliationToken()

  return (
    <main className="px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Data ingestion</p>
          <h1 className="text-3xl font-semibold text-slate-900">Structured shift submissions</h1>
          <p className="text-slate-600">
            Each submission represents a completed shift. Verification is required once per browser session; tokens
            persist in localStorage only.
          </p>
        </header>

        {!token && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Verify your hospital email to continue with ingestion.
          </div>
        )}

        {!token && <VerificationForm onToken={saveToken} />}
        {token && <ReportForm token={token} onLogout={clearToken} />}
      </div>
    </main>
  )
}

