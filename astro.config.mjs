import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // Production custom domain
  site: 'https://livcafeandbistro.ca',

  // Served from the domain root, not a subpath
  base: '/',

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [sitemap()],
});