<div align="center">
    <a href="https://github.com/mateocallec/gdg-linz"><img src="./docs/codor_mascot.jpg?raw=true" alt="logo" height="217" /></a>
</div>

<hr />

# Codor

Created by the **Hagenberger Fünfeck** group for the **Google Developer Group DevFest Linz 2025**.,
adapted by **Codor** Team as part of the 2026 Tartu Erasmus BIP

<img src="./docs/dashboard.png?raw=true" alt="logo" height="512" />

## Overview

This software is designed for teachers to upload exercises and for students to complete them directly within the platform. It features:

- **Automatic grading**: AI evaluates the exercises and assigns grades instantly.
- **Integrated chatbot**: Provides assistance and answers to student questions in real-time.

## Features

- Easy exercise upload for teachers
- Real-time student interaction (with IDE)
- AI-powered automatic grading
- Chatbot support for students

## Getting Started

### Docker deployment (single source of truth)

The repository root has a `docker-compose.yaml` that defines frontend + backend and reverse-proxy labels in one place.

1. Copy env template and fill values:

```bash
cp .env.example .env
```

2. Set at minimum:

- `API_DOMAIN` (e.g. `api.codor.karer.tech`)
- `FRONTEND_DOMAIN` (e.g. `app.codor.karer.tech`)
- `CORS_ALLOWED_ORIGINS` (comma-separated, e.g. `https://app.codor.karer.tech,http://localhost:8080`)
- Supabase/OpenRouter credentials

3. Deploy from repository root:

```bash
docker compose up -d --build
```

Important: set `API_DOMAIN` and `FRONTEND_DOMAIN` before deploying — the compose labels reference them directly. Note that Coolify's variable parser does not support shell modifiers like `${VAR:?msg}` or `${VAR:-default}`, so plain `${VAR}` references are used.

### 1. Clone the repository

First, clone the project from GitHub and move into the project directory:

### 2. Frontend setup

The frontend is located in the `frontend/` directory and must be started using **npm**.

```bash
cd frontend
npm install
npm run dev
```

This will start the frontend development server.

---

### 3. Backend setup

The backend is located in the `backend/` directory and is managed using Docker.

```bash
cd backend
./docker-manager.sh create --env-file .env
```

This command will create and start the backend services using the configuration provided in the `.env` file.

For more details about available backend commands, you can run:

```bash
./docker-manager.sh help
```

## License

This project uses a **proprietary license** and is owned collectively by all contributors.
