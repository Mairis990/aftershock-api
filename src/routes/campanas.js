import { Router } from 'express';
import { z } from 'zod';
import { query, transaccion } from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { noEncontrado } from '../utils/errors.js';

const router = Router();

const BASE_SQL = `
  SELECT c.id, c.nombre, c.descripcion, c.verificada, c.meta, c.recaudo,
         c.entidad_responsable AS "entidadResponsable",
         c.latitud, c.longitud, c.direccion,
         c.necesidad_id AS "necesidadId", n.nombre AS necesidad,
         CASE WHEN c.necesidad_id IS NULL THEN NULL ELSE
           (SELECT count(DISTINCT s.id)::int FROM solicitudes s
              JOIN solicitud_necesidades sn ON sn.solicitud_id = s.id
             WHERE sn.necesidad_id = c.necesidad_id
               AND s.estado IN ('Pendiente','En revisión','En proceso')) END AS "solicitudesAbiertas",
         (SELECT count(*)::int FROM ayudas a WHERE a.campana_id = c.id) AS "ayudasEntregadas",
         COALESCE((SELECT json_agg(json_build_object('concepto', d.concepto, 'porcentaje', d.porcentaje) ORDER BY d.id)
                   FROM campana_destinos d WHERE d.campana_id = c.id), '[]'::json) AS destinos
  FROM campanas c LEFT JOIN necesidades n ON n.id = c.necesidad_id`;

const idValido = (valor) => {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw noEncontrado('Campaña no encontrada');
  return id;
};

// Público: el donante puede ver campañas antes de iniciar sesión.
router.get('/', async (req, res) => {
  const soloVerificadas = req.query.estado === 'Verificada';
  const { rows } = await query(
    `${BASE_SQL} ${soloVerificadas ? 'WHERE c.verificada' : ''} ORDER BY c.verificada DESC, c.id DESC`);
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await query(`${BASE_SQL} WHERE c.id = $1`, [idValido(req.params.id)]);
  if (!rows[0]) throw noEncontrado('Campaña no encontrada');
  res.json(rows[0]);
});

const crearSchema = z.object({
  nombre: z.string().trim().min(5).max(120),
  descripcion: z.string().trim().min(10).max(600),
  meta: z.number().int().positive().max(10_000_000_000),
  entidadResponsable: z.string().trim().min(3).max(120),
  necesidadId: z.number().int().positive().nullish(),
  latitud: z.number().min(-90).max(90).nullish(),
  longitud: z.number().min(-180).max(180).nullish(),
  direccion: z.string().trim().max(160).nullish(),
  destinos: z.array(z.object({
    concepto: z.string().trim().min(2).max(80),
    porcentaje: z.number().int().min(1).max(100),
  })).min(1).refine((d) => d.reduce((a, x) => a + x.porcentaje, 0) === 100,
    'Los porcentajes de destino deben sumar 100'),
}).refine((d) => (d.latitud == null) === (d.longitud == null),
  { message: 'Indica latitud y longitud juntas', path: ['latitud'] });

router.post('/', requireAuth, requireRol('administrador'), async (req, res) => {
  const d = crearSchema.parse(req.body);
  const id = await transaccion(async (db) => {
    const c = await db.query(
      `INSERT INTO campanas (nombre, descripcion, meta, entidad_responsable, necesidad_id,
                             latitud, longitud, direccion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [d.nombre, d.descripcion, d.meta, d.entidadResponsable, d.necesidadId ?? null,
       d.latitud ?? null, d.longitud ?? null, d.direccion || null]);
    for (const x of d.destinos) {
      await db.query(
        'INSERT INTO campana_destinos (campana_id, concepto, porcentaje) VALUES ($1,$2,$3)',
        [c.rows[0].id, x.concepto, x.porcentaje]);
    }
    return c.rows[0].id;
  });
  res.status(201).json((await query(`${BASE_SQL} WHERE c.id = $1`, [id])).rows[0]);
});

router.patch('/:id/verificar', requireAuth, requireRol('administrador'), async (req, res) => {
  const id = idValido(req.params.id);
  const { verificada } = z.object({ verificada: z.boolean() }).parse(req.body);
  const { rowCount } = await query('UPDATE campanas SET verificada = $2 WHERE id = $1', [id, verificada]);
  if (!rowCount) throw noEncontrado('Campaña no encontrada');
  res.json((await query(`${BASE_SQL} WHERE c.id = $1`, [id])).rows[0]);
});

export default router;
