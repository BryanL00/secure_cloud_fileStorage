import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// Reuse the backend's self-signed cert so the dev server is served over HTTPS
// too. This keeps client and server on the same (TLS) scheme, so the HttpOnly
// auth cookie is sent correctly. Falls back to HTTP if the cert is absent.
const keyPath = path.resolve(__dirname, '../backend/certs/server.key')
const certPath = path.resolve(__dirname, '../backend/certs/server.cert')
const httpsConfig = fs.existsSync(keyPath) && fs.existsSync(certPath)
  ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
  : undefined

export default defineConfig({
  plugins: [react()],
  server: { https: httpsConfig },
})