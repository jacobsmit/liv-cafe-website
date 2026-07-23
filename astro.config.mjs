import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // Your GitHub Pages full site URL (project site)
  site: 'https://jacobsmit.github.io/liv-cafe-website',

  // The exact name of your repository, starting with a forward slash
  base: '/liv-cafe-website',

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [sitemap()],
});