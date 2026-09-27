import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        // Booking desk for the owner, served at /desk (see vercel.json)
        desk: resolve(import.meta.dirname, 'desk.html'),
        // Public UPI payment page, served at /pay
        pay: resolve(import.meta.dirname, 'pay.html'),
      },
    },
  },
})
