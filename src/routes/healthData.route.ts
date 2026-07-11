import fs from 'node:fs/promises';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { parseHealthDataFile } from '../services/healthDataParser';

const ONE_GB = 1024 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _file, cb) => cb(null, `health-export-${randomUUID()}.zip`),
  }),
  limits: { fileSize: ONE_GB },
});

export const healthDataRouter = Router();

healthDataRouter.post('/parse-health-data', upload.single('export'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Missing "export" file field (Apple Health export.zip)' });
    return;
  }

  const zipPath = req.file.path;

  try {
    await parseHealthDataFile(zipPath, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error while parsing export.zip';
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    } else {
      res.write(`${JSON.stringify({ type: 'error', message })}\n`);
      res.end();
    }
  } finally {
    // Health data must not linger on disk beyond this request.
    await fs.unlink(zipPath).catch(() => undefined);
  }
});
