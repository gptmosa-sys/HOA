import { put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data } = req.body;

  if (!data) {
    return res.status(400).json({ error: 'No data provided' });
  }

  const key = 'hoa-state.json';

  try {
    const { url } = await put(key, JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    return res.status(200).json({ success: true, url });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to save to Blob' });
  }
}
