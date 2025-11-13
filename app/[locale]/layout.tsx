import Link from "next/link"
import { Analytics } from "@vercel/analytics/next"
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { LanguageSwitcher } from '@/components/language-switcher';
import { geistSans, geistMono } from '@/app/fonts';
import { cn } from '@/lib/utils';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type SupportedLocale = (typeof routing.locales)[number];

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: SupportedLocale }>;
}) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale)) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages({ locale });
  const t = await getTranslations({ locale, namespace: 'navigation' });

  const navLinks = [
    { href: `/${locale}`, label: t('home') },
    { href: `/${locale}/about`, label: t('about') },
    { href: `/${locale}/verify`, label: t('verify') },
    { href: `/${locale}/data-ingestion`, label: t('dataIngestion') },
    { href: `/${locale}/public-dashboard`, label: t('dashboard') },
  ]

  return (
    <html lang={locale} className={cn(geistSans.variable, geistMono.variable)}>
      <body className={cn(
        geistSans.className,
        'bg-white text-slate-900 antialiased font-sans'
      )}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
            <div className="mx-auto flex flex-wrap gap-4 items-center justify-between px-4 py-4 max-w-6xl">
              <Link href={`/${locale}`} className="font-semibold tracking-tight text-slate-900 flex items-center gap-2 text-lg">
                <span>🏥</span>
                <span>Open Working Hours</span>
              </Link>
              <div className="flex flex-col items-end gap-3 text-sm text-slate-600">
                <div className="rounded-full border border-slate-200 px-3 py-1 bg-white/70 shadow-sm">
                  <LanguageSwitcher currentLocale={locale} />
                </div>
                <nav className="flex items-center gap-4">
                  {navLinks.map((link) => (
                    <Link key={link.href} href={link.href} className="hover:text-slate-900 transition-colors">
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          </header>
          {children}
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
