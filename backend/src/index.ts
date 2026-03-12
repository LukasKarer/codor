import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import exercisesRouter from './routes/exercises';
import usersRouter from './routes/users';
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

// Mount all routes under /v1
app.use('/v1', exercisesRouter);
app.use('/v1', usersRouter);
app.use('/v1', aiRouter);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
