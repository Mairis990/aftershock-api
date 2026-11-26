import { ZodError } from 'zod';
import { HttpError } from '../utils/errors.js';

export function manejarErrores(err, _req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof ZodError) {
    const primero = err.issues[0];
    const campo = primero.path.join('.');
    return res.status(400).json({ error: campo ? `${campo}: ${primero.message}` : primero.message });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
  if (err.code === '23503') return res.status(400).json({ error: 'La referencia indicada no existe.' });
  if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con esos datos.' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
}
