// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://openworkinghours.org',

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [react(), sitemap()],

  // The plain-language explainer pages (/privacy, /de/privacy) were retired in May 2026 and
  // consolidated into the formal /app-privacy-policy page (with a new at-a-glance summary).
  redirects: {
    '/privacy': '/app-privacy-policy#summary',
    '/de/privacy': '/de/app-privacy-policy#summary',
  },
});