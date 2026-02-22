import { head } from '@vercel/blob';
import { promises as fs } from 'fs';
import path from 'path';

const isVercel = process.env.VERCEL === '1';
const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
const preferBlob = process.env.PERSIST_MODE === 'blob' || (isVercel && hasBlobToken);
const blobAccess = process.env.BLOB_ACCESS; // optional: 'public' or 'private'
const FILE_PATH = isVercel
  ? path.join(process.env.TMPDIR || '/tmp', 'data.json')
  : path.join(process.cwd(), 'data.json');
const BLOB_KEY = 'hoa-state.json';

function logDebug(...args) {
  console.log('[storage/get]', ...args);
}

async function readFromFile() {
  const raw = await fs.readFile(FILE_PATH, 'utf8');
  return JSON.parse(raw);
}

async function readFromBlob() {
  console.log('get-state.js: Attempting Blob get for key=' + BLOB_KEY);
  console.log('get-state.js: VERCEL=' + process.env.VERCEL);
  console.log('get-state.js: PERSIST_MODE=' + process.env.PERSIST_MODE);
  console.log('get-state.js: BLOB_READ_WRITE_TOKEN exists? ' + !!process.env.BLOB_READ_WRITE_TOKEN);
  console.log('get-state.js: Token length: ' + (process.env.BLOB_READ_WRITE_TOKEN ? process.env.BLOB_READ_WRITE_TOKEN.length : 'missing'));
  console.log('get-state.js: BLOB_ACCESS=' + (blobAccess || 'unspecified'));
  const meta = await head(BLOB_KEY, {
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
  const blobRes = await fetch(meta.downloadUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
  });
  if (!blobRes.ok) throw new Error('Blob fetch failed');
  return await blobRes.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    logDebug('attempt', preferBlob ? 'blob' : 'file', {
      isVercel,
      hasBlobToken,
      filePath: FILE_PATH,
      blobKey: BLOB_KEY
    });
    const data = preferBlob ? await readFromBlob() : await readFromFile();
    res.setHeader('X-Persist-Mode', preferBlob ? 'blob' : 'file');
    logDebug('success', preferBlob ? 'blob' : 'file');
    return res.status(200).json(data);
  } catch (error) {
    console.error('Primary load failed', error);
    // Fallback to file; works locally and in Vercel (/tmp).
    if (preferBlob) {
      try {
        const data = await readFromFile();
        res.setHeader('X-Persist-Mode', 'file');
        logDebug('fallback-file-success');
        return res.status(200).json(data);
      } catch (fallbackErr) {
        console.error('File fallback failed', fallbackErr);
      }
    }
    // As a last resort, seed an empty state so the app can start cleanly.
    const emptyState = {
      users: [],
      dues: [],
      projects: [],
      documents: [],
      meetings: [],
      votes: [],
      financials: [],
      timestamp: new Date().toISOString()
    };
    try {
      await fs.writeFile(FILE_PATH, JSON.stringify(emptyState, null, 2), 'utf8');
      logDebug('seeded-empty-state', { filePath: FILE_PATH });
      res.setHeader('X-Persist-Mode', 'file');
      return res.status(200).json(emptyState);
    } catch (seedErr) {
      console.error('Failed to seed empty state', seedErr);
      return res.status(500).json({
        error: 'No state found and seeding failed',
        detail: error?.message || 'unknown',
        seedError: seedErr?.message || 'unknown',
        tried: preferBlob ? 'blob' : 'file',
        filePath: FILE_PATH,
        blobKey: BLOB_KEY
      });
    }
  }
}

// Ensure Node runtime (not Edge) so filesystem access works for fallbacks/seeding.
export const config = {
  runtime: 'nodejs'
};
