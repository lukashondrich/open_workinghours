"use client"

import { VerificationForm } from "@/components/verification-form"
import { ReportForm } from "@/components/report-form"
import { useAffiliationToken } from "@/hooks/useAffiliationToken"

export default function VerifyPage() {
  const { token, saveToken, clearToken } = useAffiliationToken()

  return (
    <main className="px-6 py-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Affiliation</p>
          <h1 className="text-3xl font-semibold text-slate-900">Verify & ingest data</h1>
          <p className="text-slate-600">
            Step 1 verifies your hospital email. Step 2 captures aggregated shift reports using your affiliation token.
          </p>
        </header>

        {!token && <VerificationForm onToken={saveToken} />}

        {token && (
          <>
            <VerificationForm onToken={saveToken} />
            <ReportForm token={token} onLogout={clearToken} />
          </>
        )}
      </div>
    </main>
  )
}

