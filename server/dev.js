import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const api = spawn(process.execPath, [resolve(root, 'server/index.js')], { cwd: root, stdio: 'inherit' })
const vite = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1'], { cwd: root, stdio: 'inherit' })
const children = [api, vite]
let stopping = false

function stopAll(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM')
  setTimeout(() => process.exit(code), 100)
}

for (const child of children) child.on('exit', (code) => { if (!stopping) stopAll(code || 0) })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stopAll(0))
