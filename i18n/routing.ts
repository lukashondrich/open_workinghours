import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  // All supported locales:
  locales: ['en', 'de', 'pt-BR'],
  // Default when nothing matches:
  defaultLocale: 'en'
});
