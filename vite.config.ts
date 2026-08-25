import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BASE_PATH is set by the GitHub Actions workflow (e.g. /h2c-tracker-xxxx/); local dev uses '/'.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
} as any)
