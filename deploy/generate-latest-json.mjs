import fs from 'node:fs';
import path from 'node:path';

function normalizeTagToVersion(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const v = raw.startsWith('v') ? raw.slice(1) : raw;
  if (!/^\d+\.\d+\.\d+([\-+].+)?$/.test(v)) {
    throw new Error(`Invalid version/tag "${raw}". Expected like v1.2.3 or 1.2.3`);
  }
  return v;
}

function findFirstFile(dir, predicate) {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isFile()) {
      const p = path.join(dir, e.name);
      if (predicate(p)) return p;
    }
  }
  return null;
}

function repoRoot() {
  return path.resolve(process.cwd());
}

const version =
  normalizeTagToVersion(process.env.VERSION) ??
  normalizeTagToVersion(process.env.RELEASE_TAG) ??
  normalizeTagToVersion(process.env.GITHUB_REF_NAME);

if (!version) {
  console.log('[generate-latest-json] No tag/version detected. Skipping latest.json generation.');
  process.exit(0);
}

const root = repoRoot();
const bundleNsisDir = path.join(root, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const installerPath = findFirstFile(bundleNsisDir, (p) => p.toLowerCase().endsWith('.exe'));

if (!installerPath) {
  throw new Error(
    `[generate-latest-json] Cannot find NSIS installer (.exe) under: ${bundleNsisDir}`
  );
}

const installerName = path.basename(installerPath);
const signaturePath = findFirstFile(bundleNsisDir, (p) => p.toLowerCase().endsWith('.sig'));
const signature = signaturePath ? fs.readFileSync(signaturePath, 'utf8').trim() : null;

// Prefer GitHub Releases download URL when available.
// Example:
// - RELEASE_REPO=Simprint/simprint-release
// - RELEASE_TAG=v1.2.3
// -> https://github.com/Simprint/simprint-release/releases/download/v1.2.3/<asset>
const releaseRepo = process.env.RELEASE_REPO || process.env.GITHUB_REPOSITORY;
const tag = process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || `v${version}`;
const baseUrl =
  process.env.DOWNLOAD_BASE_URL ||
  (releaseRepo ? `https://github.com/${releaseRepo}/releases/download/${tag}` : null);

if (!baseUrl) {
  throw new Error(
    '[generate-latest-json] Missing DOWNLOAD_BASE_URL and cannot infer from GITHUB_REPOSITORY.'
  );
}

const url = `${baseUrl}/${encodeURIComponent(installerName)}`;

// Optional: R2 public URL, e.g. https://r2.example.com/releases
// Final R2 URL will be: ${R2_PUBLIC_BASE_URL}/${version}/simprint_setup.exe
const r2Base = process.env.R2_PUBLIC_BASE_URL;
const r2Url = r2Base
  ? `${r2Base.replace(/\/$/, '')}/${version}/simprint_setup.exe`
  : null;
const pub_date = new Date().toISOString();
const notes = process.env.RELEASE_NOTES || '';

// Tauri updater-style manifest (works for many clients).
// Platform key: use the Rust target triple for Windows MSVC.
const latest = {
  version,
  notes,
  pub_date,
  platforms: {
    'x86_64-pc-windows-msvc': {
      url,
      ...(signature ? { signature } : {}),
      ...(r2Url ? { r2_url: r2Url } : {}),
    },
  },
};

const outPath = path.join(root, 'latest.json');
fs.writeFileSync(outPath, JSON.stringify(latest, null, 2) + '\n', 'utf8');

console.log(`[generate-latest-json] Wrote ${path.relative(root, outPath)}`);
console.log(`[generate-latest-json] Installer: ${installerName}`);
console.log(`[generate-latest-json] URL: ${url}`);
console.log(`[generate-latest-json] Signature: ${signature ? 'present' : 'missing'}`);

