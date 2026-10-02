# express-boilerplate

A TypeScript REST API starter built on Express 5.

## Stack

- **Express 5**: async errors are forwarded to the error handler automatically
- **TypeScript** (NodeNext ESM), with `tsx` for development and `tsc` for builds
- **zod**: environment variable and request validation
- **pino** / **pino-http**: structured logging (pretty-printed in development)
- **helmet**, **cors**: security headers and CORS
- **Vitest** + **Supertest**: tests
- **Biome**: linting and formatting

## Getting started

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:3000/api/health
```

## Scripts

| Script              | Description                            |
| ------------------- | -------------------------------------- |
| `npm run dev`       | Start in watch mode                    |
| `npm run build`     | Compile to `dist/`                     |
| `npm start`         | Run the compiled server                |
| `npm test`          | Run tests once (`test:watch` to watch) |
| `npm run typecheck` | Type-check without emitting            |
| `npm run lint`      | Lint + format check with Biome      |
| `npm run lint:fix`  | Apply safe Biome fixes              |
| `npm run format`    | Format with Biome                   |

## Structure

```
src/
  app.ts               # createApp(): middleware + routes (no listen, so it's testable)
  server.ts            # entry point: listen + graceful shutdown
  config/env.ts        # validated environment variables
  routes/              # routers, mounted under /api
  middleware/          # errorHandler, notFound, validate
  utils/               # HttpError, logger
tests/                 # Supertest tests against createApp()
```

## Adding a route

```ts
// src/routes/users.ts
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../utils/HttpError.js';

export const usersRouter = Router();

usersRouter.get(
  '/:id',
  validate({ params: z.object({ id: z.coerce.number() }) }),
  async (req, res) => {
    const user = await findUser(req.params.id);
    if (!user) throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
    res.json(user);
  },
);
```

Then mount it in `src/routes/index.ts` with `router.use('/users', usersRouter)`.

## Errors

Every error response has this shape:

```json
{ "error": { "message": "...", "code": "...", "details": [] } }
```

- Throw `HttpError(status, message, code?, details?)` for expected errors.
- A validation failure returns `400` with `code: "VALIDATION_ERROR"`.
- In production, a 5xx error returns a generic message and no stack trace.

## Environment

| Variable      | Default       |
| ------------- | ------------- |
| `NODE_ENV`    | `development` |
| `PORT`        | `3000`        |
| `LOG_LEVEL`   | `info`        |
| `CORS_ORIGIN` | `*`           |

## Docker

```bash
docker build -t express-boilerplate .
docker run -p 3000:3000 express-boilerplate
```
