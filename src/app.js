import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { manejarErrores } from './middleware/errores.js';
import auth from './routes/auth.js';
import me from './routes/me.js';
import necesidades from './routes/necesidades.js';
import solicitudes from './routes/solicitudes.js';
import personas from './routes/personas.js';
import campanas from './routes/campanas.js';
import donaciones from './routes/donaciones.js';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/api/v1/salud', (_req, res) => res.json({ ok: true }));

app.use('/api/v1/auth', auth);
app.use('/api/v1/me', me);
app.use('/api/v1/necesidades', necesidades);
app.use('/api/v1/solicitudes', solicitudes);
app.use('/api/v1/personas', personas);
app.use('/api/v1/campanas', campanas);
app.use('/api/v1/donaciones', donaciones);

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use(manejarErrores);
