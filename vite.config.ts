import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command }) => ({
  // Se incluye el plugin de tailwindcss que requiere la versión 4
  plugins: [react(), tailwindcss()],
  // Si estamos desarrollando (serve) usa '/', si estamos compilando usa './' para Electron
  base: command === 'serve' ? '/' : './',
}));