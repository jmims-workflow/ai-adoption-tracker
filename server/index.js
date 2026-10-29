import './env.js';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedIfEmpty } from './seed.js';
import { aiMode } from './ai.js';
import apiRoutes from './routes/api.js';
import aiRoutes from './routes/ai.js';
import importRoutes from './routes/import.js';

seedIfEmpty();

const app = express();
app.use(express.json({ limit: '100kb' }));

app.use('/api', apiRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/import', importRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'Something went wrong.' });
});

// In production, serve the built client.
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port} (AI mode: ${aiMode})`);
});
