#!/usr/bin/env node

import { runShellCli } from '../shell/cli.js'

void runShellCli(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(message)
  process.exitCode = 1
})
