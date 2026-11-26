import { Router } from 'express';
import { z } from 'zod';
import { query, transaccion } from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { HttpError, noEncontrado } from '../utils/errors.js';

const router = Router();
router.use(requireAuth, requireRol('donante'));

const AVISO = 'Donación simulada: no se realizó ningún cobro real.';

const donacionSchema = z.object({
  campanaId: z.number().int().positive(),
  monto: z.number().int().min(1000, 'El monto mínimo es $1.000').max(100_000_000),
  metodoPago: z.enum(['Tarjeta', 'PSE', 'Transferencia']),
});

router.post('/', async (req, res) => {
  const { campanaId, monto, metodoPago } = donacionSchema.parse(req.body);
  const donacion = await transaccion(async (db) => {
    const c = await db.query('SELECT verificada FROM campanas WHERE id = $1 FOR UPDATE', [campanaId]);
    if (!c.rows[0]) throw noEncontrado('Campaña no encontrada');
    if (!c.rows[0].verificada) throw new HttpError(409, 'Solo se puede donar a campañas verificadas.');
    const d = await db.query(
      `INSERT INTO donaciones (usuario_id, campana_id, monto, metodo_pago)
       VALUES ($1,$2,$3,$4)
       RETURNING id, campana_id AS "campanaId", monto, metodo_pago AS "metodoPago",
                 estado, creado_en AS "fecha"`,
      [req.user.id, campanaId, monto, metodoPago]);
    await db.query('UPDATE campanas SET recaudo = recaudo + $2 WHERE id = $1', [campanaId, monto]);
    return d.rows[0];
  });
  res.status(201).json({ ...donacion, aviso: AVISO });
});

router.get('/mias', async (req, res) => {
  const { rows } = await query(
    `SELECT d.id, d.campana_id AS "campanaId", c.nombre AS "campanaNombre", d.monto,
            d.metodo_pago AS "metodoPago", d.estado, d.creado_en AS fecha
     FROM donaciones d JOIN campanas c ON c.id = d.campana_id
     WHERE d.usuario_id = $1 ORDER BY d.creado_en DESC`, [req.user.id]);
  res.json(rows.map((r) => ({ ...r, aviso: AVISO })));
});

export default router;
