"use client"

import { usePathname, useRouter } from 'next/navigation';
import { routing } from '@/i18n/routing';

const languageNames: Record<string, string> = {
  'en': 'EN',
  'de': 'DE',
  'pt-BR': 'PT'
};

export function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const switchLocale = (newLocale: string) => {
    // Remove the current locale from the pathname
    const pathnameWithoutLocale = pathname.replace(`/${currentLocale}`, '');
    // Redirect to the new locale
    router.push(`/${newLocale}${pathnameWithoutLocale || ''}`);
  };

  return (
    <div className="flex items-center gap-2">
      {routing.locales.map((locale) => (
        <button
          key={locale}
          onClick={() => switchLocale(locale)}
          className={`px-2 py-1 text-xs font-medium transition-colors ${
            currentLocale === locale
              ? 'text-slate-900 underline'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          {languageNames[locale]}
        </button>
      ))}
    </div>
  );
}
