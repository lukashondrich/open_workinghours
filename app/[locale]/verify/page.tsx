"use client"

import { VerificationForm } from "@/components/verification-form"
import { useAffiliationToken } from "@/hooks/useAffiliationToken"
import { useTranslations } from "next-intl"

export default function VerifyPage() {
  const { saveToken } = useAffiliationToken()
  const t = useTranslations('verify')

  return (
    <main className="px-6 py-16">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-medium">{t('label')}</p>
          <h1 className="text-4xl font-light text-slate-900">{t('title')}</h1>
          <p className="text-slate-500 font-light leading-relaxed">
            {t('description')}
          </p>
        </header>

        <VerificationForm onToken={saveToken} />
      </div>
    </main>
  )
}
