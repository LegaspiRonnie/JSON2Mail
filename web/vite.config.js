import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the same build works at any mount path: '/' on Vercel,
  // '/app/' when Laravel serves the bundle inside the desktop app.
  base: './',
})
