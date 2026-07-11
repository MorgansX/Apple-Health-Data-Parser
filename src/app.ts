import express, { Express, Request, Response } from 'express';
import { healthDataRouter } from './routes/healthData.route';

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/v1', healthDataRouter);

  return app;
}
