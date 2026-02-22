import { get } from '@vercel/blob';
import { promises as fs } from 'fs';
import path from 'path';

const useFile = process.env.PERSIST_MODE === 'file';
const FILE_PATH = path.join(process.cwd(), 'data.json');
const BLOB_KEY = 'hoa-state.json';

async function readFromFile() {
  const raw = await fs.readFile(FILE_PATH, 'utf8');
  return JSON.parse(raw);
}

async function readFromBlob() {
  const { url } = await get(BLOB_KEY, {
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
  const blobRes = await fetch(url);
  if (!blobRes.ok) throw new Error('Blob fetch failed');
  return await blobRes.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = useFile ? await readFromFile() : await readFromBlob();
    res.setHeader('X-Persist-Mode', useFile ? 'file' : 'blob');
    return res.status(200).json(data);
  } catch (error) {
    console.error(error);
    return res.status(404).json({ error: 'No state found' });
  }
}
