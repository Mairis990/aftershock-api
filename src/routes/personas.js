import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';

const router = Router();

// RF08: el administrador consulta las personas registradas.
router.get('/', requireAuth, requireRol('administrador'), async (_req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.nombre, u.correo, p.documento, p.telefono, p.ubicacion,
            (SELECT count(*)::int FROM solicitudes s WHERE s.usuario_id = u.id) AS "totalSolicitudes"
     FROM usuarios u LEFT JOIN perfiles p ON p.usuario_id = u.id
     WHERE u.rol = 'afectada' ORDER BY u.creado_en DESC`);
  res.json(rows);
});

export default router;
