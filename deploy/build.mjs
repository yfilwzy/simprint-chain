import { spawnSync } from 'node:child_process';

function run(cmd, args, extraEnv = {}) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

// 1) Sync version from tag/env into configs
run('node', ['deploy/prepare-version.mjs']);

// 2) Build frontend (tauri.conf.json uses beforeBuildCommand, but we keep this explicit for local usage)
run('node', ['build.cjs']);

// 3) Tauri build (local usage; CI uses tauri-action)
run('pnpm', ['-s', 'exec', 'tauri', 'build']);

