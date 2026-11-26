import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db.js';
import { firmarToken } from '../middleware/auth.js';
import { HttpError } from '../utils/errors.js';

const router = Router();

const registroSchema = z.object({
  nombre: z.string().trim().min(3, 'Escribe tu nombre completo').max(100),
  correo: z.string().trim().toLowerCase().email('Correo inválido'),
  clave: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72),
  rol: z.enum(['afectada', 'donante']),
});

const loginSchema = z.object({
  correo: z.string().trim().toLowerCase().email('Correo inválido'),
  clave: z.string().min(1, 'Escribe tu contraseña'),
});

const publico = (u) => ({ id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol });

router.post('/registro', async (req, res) => {
  const { nombre, correo, clave, rol } = registroSchema.parse(req.body);
  const hash = await bcrypt.hash(clave, 10);
  try {
    const { rows } = await query(
      `INSERT INTO usuarios (nombre, correo, clave_hash, rol)
       VALUES ($1,$2,$3,$4) RETURNING id, nombre, correo, rol`,
      [nombre, correo, hash, rol],
    );
    res.status(201).json({ token: firmarToken(rows[0]), usuario: publico(rows[0]) });
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'Ya existe una cuenta con ese correo.');
    throw e;
  }
});

router.post('/login', async (req, res) => {
  const { correo, clave } = loginSchema.parse(req.body);
  const { rows } = await query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
  const u = rows[0];
  // Mismo mensaje si el correo no existe o la clave falla (no revela cuál).
  if (!u || !(await bcrypt.compare(clave, u.clave_hash))) {
    throw new HttpError(401, 'Correo o contraseña incorrectos.');
  }
  res.json({ token: firmarToken(u), usuario: publico(u) });
});

export default router;
