import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = '& ([scriptblock]::Create([IO.File]::ReadAllText($env:LIMBUS_PANEL_SCRIPT)))';
const command = Buffer.from(source, 'utf16le').toString('base64');
const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-EncodedCommand', command], {
  env: {
    ...process.env,
    LIMBUS_PANEL_SCRIPT: fileURLToPath(new URL('./probability-panel.ps1', import.meta.url)),
    LIMBUS_PANEL_NODE: process.execPath,
    LIMBUS_PANEL_ANALYZER: fileURLToPath(new URL('./analyze-screenshot.mjs', import.meta.url)),
    LIMBUS_PANEL_SAMPLE: process.argv[2] ? resolve(process.argv[2]) : '',
  },
  windowsHide: true,
  stdio: ['ignore', 'inherit', 'inherit'],
});

child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => { process.exitCode = code ?? 1; });
