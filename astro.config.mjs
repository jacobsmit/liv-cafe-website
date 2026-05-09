import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Your GitHub Pages base URL
  site: 'https://jacobsmit.github.io', 
  
  // The exact name of your repository, starting with a forward slash
  base: '/liv-cafe-website', 
  
  vite: {
    plugins: [tailwindcss()],
  },
});