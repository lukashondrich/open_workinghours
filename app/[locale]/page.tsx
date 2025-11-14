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
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-6 py-16 flex flex-col">
      <div className="max-w-5xl mx-auto space-y-16 flex-1 w-full min-h-[70vh]">
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
      <footer className="border-t border-slate-200/80 bg-white/80 mt-16">
        <div className="max-w-5xl mx-auto px-6 py-10 text-sm text-slate-600 space-y-6">
          <p className="text-slate-500">
            © 2025 OpenWorkingHours — Licensed under the{" "}
            <a
              href="https://opensource.org/licenses/MIT"
              target="_blank"
              rel="noreferrer"
              className="text-slate-900 underline underline-offset-4 hover:text-slate-700"
            >
              MIT License
            </a>
            . Documentation under{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
              className="text-slate-900 underline underline-offset-4 hover:text-slate-700"
            >
              CC BY 4.0
            </a>
            .
          </p>
          <div className="space-y-2 text-xs text-slate-600">
            <p className="text-slate-900 font-medium text-sm">Impressum</p>
            <p className="uppercase tracking-wide text-slate-500">Angaben gemäß § 5 TMG</p>
            <p className="leading-relaxed">
              Lukas Jonathan Hondrich
              <br />
              Karl-Marx Straße 182
              <br />
              12043 Berlin
              <br />
              Germany
            </p>
            <p className="leading-relaxed">
              Kontakt:{" "}
              <a
                href="mailto:lukashondrich@gmail.com"
                className="text-slate-900 underline underline-offset-4 hover:text-slate-700"
              >
                lukashondrich@gmail.com
              </a>
            </p>
            <p className="leading-relaxed">
              Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV:
              <br />
              Lukas Jonathan Hondrich
            </p>
            <p className="text-slate-500 leading-relaxed">
              Hinweis: Dieses Projekt befindet sich in einem frühen Entwicklungsstadium und enthält keine produktiven oder personenbezogenen Daten.
            </p>
          </div>
          <div className="space-y-2 text-xs text-slate-600">
            <p className="text-slate-900 font-medium text-sm">Datenschutzerklärung</p>
            <p className="leading-relaxed">
              Diese Website speichert oder verarbeitet keine personenbezogenen Daten. Es werden keine Cookies gesetzt, keine Analysetools verwendet und keine Daten an Dritte weitergegeben.
            </p>
            <p className="leading-relaxed">
              Sollten zukünftig Funktionen hinzukommen, bei denen personenbezogene Daten verarbeitet werden (z. B. Kontaktformular, Tracking oder Nutzungsanalyse), wird diese Datenschutzerklärung entsprechend angepasst.
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
