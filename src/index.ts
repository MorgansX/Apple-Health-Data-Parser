import { createApp } from './app';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Large export.zip uploads and long-running NDJSON parse responses need
// more room than Node's defaults (5min request / 60s headers).
server.requestTimeout = 15 * 60 * 1000;
server.headersTimeout = 2 * 60 * 1000;
