import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { validate } from '../src/middleware/validate.js';
import { HttpError } from '../src/utils/HttpError.js';

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });
});

describe('unknown routes', () => {
  it('returns 404 JSON', async () => {
    const res = await request(createApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('error handling', () => {
  it('returns 400 for malformed JSON', async () => {
    const res = await request(createApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
  });

  it('maps HttpError and async errors to JSON', async () => {
    const app = express();
    app.get('/teapot', async () => {
      throw new HttpError(418, 'short and stout', 'TEAPOT');
    });
    app.get('/boom', async () => {
      throw new Error('kaboom');
    });
    app.use(errorHandler);

    const teapot = await request(app).get('/teapot');
    expect(teapot.status).toBe(418);
    expect(teapot.body.error).toMatchObject({ message: 'short and stout', code: 'TEAPOT' });

    const boom = await request(app).get('/boom');
    expect(boom.status).toBe(500);
    expect(boom.body.error.message).toBe('kaboom');
  });
});

describe('validate middleware', () => {
  const app = express();
  app.use(express.json());
  app.post(
    '/items',
    validate({
      body: z.object({ name: z.string().min(1) }),
      query: z.object({ dryRun: z.coerce.boolean().default(false) }),
    }),
    (req, res) => {
      res.status(201).json({ body: req.body, query: req.query });
    },
  );
  app.use(errorHandler);

  it('passes parsed data through', async () => {
    const res = await request(app).post('/items?dryRun=1').send({ name: 'widget' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ body: { name: 'widget' }, query: { dryRun: true } });
  });

  it('rejects invalid input with 400', async () => {
    const res = await request(app).post('/items').send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
