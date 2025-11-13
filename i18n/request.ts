import {routing} from '@/i18n/routing';
import {getRequestConfig} from 'next-intl/server';

type SupportedLocale = (typeof routing.locales)[number];

const messagesLoaders: Record<SupportedLocale, () => Promise<{default: Record<string, unknown>}>> = {
  en: () => import('@/messages/en.json'),
  de: () => import('@/messages/de.json'),
  'pt-BR': () => import('@/messages/pt-BR.json')
};

export default getRequestConfig(async ({locale}) => {
  const defaultLocale = routing.defaultLocale;
  const resolvedLocale = routing.locales.includes(locale as SupportedLocale)
    ? (locale as SupportedLocale)
    : defaultLocale;

  const loadMessages =
    messagesLoaders[resolvedLocale as SupportedLocale] ??
    messagesLoaders[defaultLocale as SupportedLocale];

  const messages = (await loadMessages()).default;

  return {
    locale: resolvedLocale,
    messages
  };
});
