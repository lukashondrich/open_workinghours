import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getTranslations } from 'next-intl/server';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });

  const links = [
    {
      href: `/${locale}/verify`,
      label: t('cards.verify.title'),
      subtitle: t('cards.verify.subtitle')
    },
    {
      href: `/${locale}/data-ingestion`,
      label: t('cards.dataIngestion.title'),
      subtitle: t('cards.dataIngestion.subtitle')
    },
    {
      href: `/${locale}/public-dashboard`,
      label: t('cards.dashboard.title'),
      subtitle: t('cards.dashboard.subtitle')
    }
  ]

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-white px-6 py-16">
      <div className="max-w-5xl mx-auto space-y-16">
        {/* Hero Section */}
        <section className="space-y-6 text-center max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-light text-slate-900 leading-tight lowercase">
            {t('title')}
          </h1>
          <p className="text-slate-500 text-lg font-light leading-relaxed">
            {t('subtitle')}
          </p>
        </section>

        {/* Navigation Cards */}
        <section className="grid gap-3 md:grid-cols-3 max-w-4xl mx-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white px-6 py-5 shadow-sm transition-all hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{link.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{link.subtitle}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </section>
      </div>
    </main>
  )
}
