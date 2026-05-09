import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Required for GitHub Pages paths to work
  site: 'https://jacobsmit.github.io',
  
  // Required for Tailwind 4
  vite: {
    plugins: [tailwindcss()],
  },
});