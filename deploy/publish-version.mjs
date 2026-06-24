import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import crypto from 'node:crypto';

const apiUrl = process.env.VERSION_API_URL;
const apiKey = process.env.VERSION_API_KEY;
const releaseTag = process.env.RELEASE_TAG;
const releaseNotes = process.env.RELEASE_NOTES;

if (!apiUrl) throw new Error('VERSION_API_URL is not set');
if (!apiKey) throw new Error('VERSION_API_KEY is not set');
if (!releaseTag) throw new Error('RELEASE_TAG is not set');

const version = releaseTag.replace(/^v/, '');
const notes = (releaseNotes || '').trim() || 'Automated release';
const exePath = path.resolve('src-tauri/target/release/simprint.exe');

if (!fs.existsSync(exePath)) {
  throw new Error(`Executable not found at ${exePath}`);
}

const boundary = `----simprint-${cryptoRandomString(16)}`;
const fields = [
  'type_id',
  'resource_name',
  'version',
  'name',
  'notes',
  'platform',
  'pub_date',
];
const values = {
  type_id: '1',
  resource_name: 'simprint.exe',
  version,
  name: `simprint-${version}.exe`,
  notes,
  platform: 'windows',
  pub_date: new Date().toISOString(),
};

const startParts = fields
  .map(
    (field) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${field}"\r\n\r\n${values[field]}\r\n`
  )
  .join('');
const fileHeader =
  `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="simprint.exe"\r\nContent-Type: application/octet-stream\r\n\r\n`;
const endBoundary = `\r\n--${boundary}--\r\n`;

const preamble = Buffer.from(startParts + fileHeader, 'utf8');
const ending = Buffer.from(endBoundary, 'utf8');
const fileStats = fs.statSync(exePath);

const url = new URL(apiUrl);
const isHttps = url.protocol === 'https:';
const requestFn = isHttps ? https.request : http.request;
const port = url.port ? Number(url.port) : isHttps ? 443 : 80;
const basePath = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
const requestPath = `${basePath}/api/v1/versions/create${url.search}`;
const options = {
  method: 'POST',
  hostname: url.hostname,
  port,
  path: requestPath,
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'X-API-KEY': apiKey,
    'Content-Length': preamble.length + fileStats.size + ending.length,
  },
};
console.log(options);

const { statusCode, body } = await new Promise((resolve, reject) => {
  const req = requestFn(options, (res) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () =>
      resolve({
        statusCode: res.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
      })
    );
  });
  req.on('error', reject);
  req.write(preamble);
  const stream = fs.createReadStream(exePath);
  stream.on('error', reject);
  stream.pipe(req, { end: false });
  stream.on('end', () => req.end(ending));
});

if (statusCode < 200 || statusCode >= 300) {
  throw new Error(`versions/create returned ${statusCode}: ${body}`);
}

console.log('version metadata published', body);

function cryptoRandomString(length) {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}
