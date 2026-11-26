import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../utils/errors.js';

export function firmarToken(usuario) {
  return jwt.sign({ rol: usuario.rol }, config.jwtSecret, {
    subject: usuario.id,
    expiresIn: '7d',
  });
}

export function requireAuth(req, _res, next) {
  const cabecera = req.headers.authorization ?? '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
  if (!token) throw new HttpError(401, 'Debes iniciar sesión.');
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.sub, rol: payload.rol };
  } catch {
    throw new HttpError(401, 'Tu sesión expiró. Inicia sesión de nuevo.');
  }
  next();
}

export const requireRol = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.rol)) {
    throw new HttpError(403, 'No tienes permiso para esta acción.');
  }
  next();
};
