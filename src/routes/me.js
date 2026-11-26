import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { noEncontrado } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

const PERFIL_SQL = `SELECT documento, telefono, ubicacion, actualizado_en AS "actualizadoEn"
                    FROM perfiles WHERE usuario_id = $1`;

router.get('/', async (req, res) => {
  const { rows } = await query('SELECT id, nombre, correo, rol FROM usuarios WHERE id = $1', [req.user.id]);
  if (!rows[0]) throw noEncontrado('Usuario no encontrado');
  const perfil = (await query(PERFIL_SQL, [req.user.id])).rows[0] ?? null;
  res.json({ usuario: rows[0], perfil });
});

const perfilSchema = z.object({
  documento: z.string().trim().regex(/^\d{5,12}$/, 'Documento de 5 a 12 dígitos'),
  telefono: z.string().trim().regex(/^\d{7,12}$/, 'Teléfono de 7 a 12 dígitos'),
  ubicacion: z.string().trim().min(5, 'Describe tu ubicación').max(200),
});

router.put('/perfil', requireRol('afectada'), async (req, res) => {
  const d = perfilSchema.parse(req.body);
  const { rows } = await query(
    `INSERT INTO perfiles (usuario_id, documento, telefono, ubicacion)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (usuario_id) DO UPDATE
       SET documento = EXCLUDED.documento, telefono = EXCLUDED.telefono,
           ubicacion = EXCLUDED.ubicacion, actualizado_en = now()
     RETURNING documento, telefono, ubicacion, actualizado_en AS "actualizadoEn"`,
    [req.user.id, d.documento, d.telefono, d.ubicacion],
  );
  res.json({ perfil: rows[0] });
});

export default router;
