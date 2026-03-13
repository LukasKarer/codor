import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import exercisesRouter from './routes/exercises';
import usersRouter from './routes/users';
import profilesRouter from './routes/profiles';
import aiRouter from './routes/ai';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });
}

/**
 * GET /v1/config
 * Public endpoint: returns runtime configuration for the frontend.
 * pushIntervalMs is controlled by PUSH_INTERVAL_MS env var (default 30000).
 */
app.get('/v1/config', (_req, res) => {
  res.json({
    pushIntervalMs: parseInt(process.env.PUSH_INTERVAL_MS ?? '30000', 10),
  });
});

// Mount all routes under /v1
app.use('/v1', exercisesRouter);
app.use('/v1', usersRouter);
app.use('/v1', profilesRouter);
app.use('/v1', aiRouter);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
