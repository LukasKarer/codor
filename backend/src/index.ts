import "dotenv/config";
import express from "express";
import cors from "cors";
import exercisesRouter from "./routes/exercises";
import usersRouter from "./routes/users";
import profilesRouter from "./routes/profiles";
import aiRouter from "./routes/ai";
import organisationsRouter from "./routes/organisations";
import proxyRouter from "./routes/proxy";
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT ?? 3000;

const rawAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

function normalizeOrigin(origin: string): string {
  try {
    return new URL(origin).origin;
  } catch {
    return origin.replace(/\/+$/, '');
  }
}

const allowAllOrigins = rawAllowedOrigins.length === 0 || rawAllowedOrigins.includes('*');
const allowedOrigins = new Set(rawAllowedOrigins.map(normalizeOrigin));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowAllOrigins) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.has(normalizeOrigin(origin))) {
      callback(null, true);
      return;
    }

    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
if (process.env.NODE_ENV === "development") {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });
}

const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MIN ? parseInt(process.env.RATE_LIMIT_WINDOW_MIN, 10) * 60 * 1000 : 15 * 60 * 1000, // 15 minutes window
  max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : 10, // Limit each IP to 10 requests per windowMs
  message: {
    error: "Too many requests from this IP address",
    retryAfter: "15 minutes",
    documentation: "https://api.example.com/docs/rate-limits",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers

  handler: (req, res) => {
    res.status(429).json({
      error: "Rate limit exceeded",
      message: "Too many requests from this IP, please try again later",
      //retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

// Apply rate limiting to all requests
app.use("/v1/proxy/teavm", proxyRouter);

app.use(limiter);

/**
 * GET /v1/config
 * Public endpoint: returns runtime configuration for the frontend.
 * pushIntervalMs is controlled by PUSH_INTERVAL_MS env var (default 30000).
 */
app.get("/v1/config", (_req, res) => {
  res.json({
    pushIntervalMs: parseInt(process.env.PUSH_INTERVAL_MS ?? "30000", 10),
  });
});

// Mount all routes under /v1
app.use("/v1", exercisesRouter);
app.use("/v1", usersRouter);
app.use("/v1", profilesRouter);
app.use("/v1", aiRouter);
app.use("/v1", organisationsRouter);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
