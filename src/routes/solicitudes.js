import { Router } from 'express';
import { z } from 'zod';
import { query, transaccion } from '../db.js';
import { requireAuth, requireRol } from '../middleware/auth.js';
import { HttpError, noEncontrado } from '../utils/errors.js';
import { ESTADOS, TRANSICIONES } from '../utils/estados.js';

const router = Router();
router.use(requireAuth);

const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw noEncontrado('Solicitud no encontrada');
  return id;
};

// Lista (sin detalle) con el nombre de la persona y sus necesidades.
const LISTA_SQL = `
  SELECT s.id, s.estado, s.urgencia, s.descripcion, s.motivo_rechazo AS "motivoRechazo",
         s.otra_necesidad AS "otraNecesidad", s.confirmada_en AS "confirmadaEn",
         s.creado_en AS "creadoEn", s.actualizado_en AS "actualizadoEn",
         u.nombre AS "personaNombre", u.id AS "usuarioId",
         COALESCE((SELECT array_agg(n.nombre ORDER BY n.id)
                   FROM solicitud_necesidades sn JOIN necesidades n ON n.id = sn.necesidad_id
                   WHERE sn.solicitud_id = s.id), '{}') AS necesidades
  FROM solicitudes s JOIN usuarios u ON u.id = s.usuario_id`;

async function detalle(id) {
  const { rows } = await query(`${LISTA_SQL} WHERE s.id = $1`, [id]);
  const s = rows[0];
  if (!s) throw noEncontrado('Solicitud no encontrada');
  const [persona, ayudas, historial] = await Promise.all([
    query(
      `SELECT u.nombre, u.correo, p.documento, p.telefono, p.ubicacion
       FROM usuarios u LEFT JOIN perfiles p ON p.usuario_id = u.id WHERE u.id = $1`,
      [s.usuarioId]),
    query(
      `SELECT a.id, a.tipo, a.cantidad, a.fecha_entrega AS "fechaEntrega",
              a.campana_id AS "campanaId", c.nombre AS "campanaNombre"
       FROM ayudas a LEFT JOIN campanas c ON c.id = a.campana_id
       WHERE a.solicitud_id = $1 ORDER BY a.fecha_entrega DESC`, [id]),
    query(
      `SELECT estado_anterior AS "estadoAnterior", estado_nuevo AS "estadoNuevo", motivo, fecha
       FROM solicitud_historial WHERE solicitud_id = $1 ORDER BY fecha`, [id]),
  ]);
  return { ...s, persona: persona.rows[0], ayudas: ayudas.rows, historial: historial.rows };
}

// ---------- Persona afectada ----------

const crearSchema = z
  .object({
    necesidades: z.array(z.string().trim().min(1)).max(10).default([]),
    otraNecesidad: z.string().trim().max(120).optional(),
    urgencia: z.enum(['normal', 'urgente', 'critica']).default('normal'),
    descripcion: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.necesidades.length > 0 || d.otraNecesidad,
    { message: 'Selecciona al menos una necesidad o describe otra', path: ['necesidades'] });

router.post('/', requireRol('afectada'), async (req, res) => {
  const { necesidades, otraNecesidad, urgencia, descripcion } = crearSchema.parse(req.body);
  const perfil = await query('SELECT 1 FROM perfiles WHERE usuario_id = $1', [req.user.id]);
  if (!perfil.rowCount) throw new HttpError(409, 'Completa tu perfil antes de solicitar ayuda.');

  const id = await transaccion(async (db) => {
    const nec = await db.query('SELECT id FROM necesidades WHERE nombre = ANY($1)', [necesidades]);
    if (nec.rowCount !== new Set(necesidades).size) throw new HttpError(400, 'Hay necesidades no válidas.');
    const s = await db.query(
      `INSERT INTO solicitudes (usuario_id, urgencia, otra_necesidad, descripcion)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [req.user.id, urgencia, otraNecesidad || null, descripcion || null]);
    const sid = s.rows[0].id;
    if (nec.rowCount) {
      await db.query(
        `INSERT INTO solicitud_necesidades (solicitud_id, necesidad_id)
         SELECT $1, unnest($2::int[])`, [sid, nec.rows.map((r) => r.id)]);
    }
    await db.query(
      `INSERT INTO solicitud_historial (solicitud_id, estado_nuevo) VALUES ($1,'Pendiente')`, [sid]);
    return sid;
  });
  res.status(201).json(await detalle(id));
});

router.get('/mias', requireRol('afectada'), async (req, res) => {
  const { rows } = await query(
    `${LISTA_SQL} WHERE s.usuario_id = $1 ORDER BY s.creado_en DESC`, [req.user.id]);
  res.json(rows);
});

// Últimos cambios de estado de MIS solicitudes (sección "Novedades").
router.get('/novedades', requireRol('afectada'), async (req, res) => {
  const { rows } = await query(
    `SELECT h.solicitud_id AS "solicitudId", h.estado_anterior AS "estadoAnterior",
            h.estado_nuevo AS "estadoNuevo", h.motivo, h.fecha
     FROM solicitud_historial h JOIN solicitudes s ON s.id = h.solicitud_id
     WHERE s.usuario_id = $1 ORDER BY h.fecha DESC LIMIT 30`, [req.user.id]);
  res.json(rows);
});

router.post('/:id/cancelar', requireRol('afectada'), async (req, res) => {
  const id = idParam(req);
  await transaccion(async (db) => {
    const { rows } = await db.query(
      'SELECT estado, usuario_id FROM solicitudes WHERE id = $1 FOR UPDATE', [id]);
    if (!rows[0] || rows[0].usuario_id !== req.user.id) throw noEncontrado('Solicitud no encontrada');
    if (rows[0].estado !== 'Pendiente') {
      throw new HttpError(409, 'Solo puedes cancelar solicitudes que siguen pendientes.');
    }
    await db.query(`UPDATE solicitudes SET estado = 'Cancelada', actualizado_en = now() WHERE id = $1`, [id]);
    await db.query(
      `INSERT INTO solicitud_historial (solicitud_id, estado_anterior, estado_nuevo, motivo)
       VALUES ($1,'Pendiente','Cancelada','Cancelada por la persona solicitante')`, [id]);
  });
  res.json(await detalle(id));
});

// "Ya recibí mi ayuda": la persona confirma que la ayuda le llegó.
router.post('/:id/confirmar', requireRol('afectada'), async (req, res) => {
  const id = idParam(req);
  const { rows } = await query('SELECT estado, usuario_id, confirmada_en FROM solicitudes WHERE id = $1', [id]);
  if (!rows[0] || rows[0].usuario_id !== req.user.id) throw noEncontrado('Solicitud no encontrada');
  if (rows[0].estado !== 'Atendida') throw new HttpError(409, 'Solo puedes confirmar solicitudes atendidas.');
  if (rows[0].confirmada_en) throw new HttpError(409, 'Ya confirmaste la recepción de tu ayuda.');
  await query('UPDATE solicitudes SET confirmada_en = now() WHERE id = $1', [id]);
  res.json(await detalle(id));
});

// ---------- Administrador ----------

router.get('/', requireRol('administrador'), async (req, res) => {
  const estado = req.query.estado;
  if (estado && !ESTADOS.includes(estado)) throw new HttpError(400, 'Estado no válido.');
  const { rows } = estado
    ? await query(`${LISTA_SQL} WHERE s.estado = $1 ORDER BY s.creado_en DESC`, [estado])
    : await query(`${LISTA_SQL} ORDER BY s.creado_en DESC`);
  res.json(rows);
});

// Dueña de la solicitud o administrador.
router.get('/:id', async (req, res) => {
  const s = await detalle(idParam(req));
  if (req.user.rol !== 'administrador' && s.usuarioId !== req.user.id) {
    throw noEncontrado('Solicitud no encontrada'); // no revelamos que existe
  }
  res.json(s);
});

const estadoSchema = z.object({
  estado: z.enum(ESTADOS),
  motivo: z.string().trim().max(300).optional(),
});

router.patch('/:id/estado', requireRol('administrador'), async (req, res) => {
  const id = idParam(req);
  const { estado, motivo } = estadoSchema.parse(req.body);
  if (estado === 'Rechazada' && !motivo) throw new HttpError(400, 'Indica el motivo del rechazo.');

  await transaccion(async (db) => {
    const { rows } = await db.query('SELECT estado FROM solicitudes WHERE id = $1 FOR UPDATE', [id]);
    if (!rows[0]) throw noEncontrado('Solicitud no encontrada');
    const actual = rows[0].estado;
    if (!TRANSICIONES[actual].includes(estado)) {
      throw new HttpError(409, `No se puede pasar de "${actual}" a "${estado}".`);
    }
    await db.query(
      `UPDATE solicitudes SET estado = $2, motivo_rechazo = $3, actualizado_en = now() WHERE id = $1`,
      [id, estado, estado === 'Rechazada' ? motivo : null]);
    await db.query(
      `INSERT INTO solicitud_historial (solicitud_id, estado_anterior, estado_nuevo, motivo, admin_id)
       VALUES ($1,$2,$3,$4,$5)`, [id, actual, estado, motivo || null, req.user.id]);
  });
  res.json(await detalle(id));
});

const ayudaSchema = z.object({
  tipo: z.string().trim().min(2, 'Indica el tipo de ayuda').max(100),
  cantidad: z.number().int().positive('La cantidad debe ser mayor que 0').max(100000),
  campanaId: z.number().int().positive().nullish(),
});

router.post('/:id/ayudas', requireRol('administrador'), async (req, res) => {
  const id = idParam(req);
  const { tipo, cantidad, campanaId } = ayudaSchema.parse(req.body);
  const { rows } = await query('SELECT estado FROM solicitudes WHERE id = $1', [id]);
  if (!rows[0]) throw noEncontrado('Solicitud no encontrada');
  if (rows[0].estado !== 'En proceso') {
    throw new HttpError(409, 'Solo se registran ayudas en solicitudes "En proceso".');
  }
  if (campanaId) {
    const c = await query('SELECT verificada FROM campanas WHERE id = $1', [campanaId]);
    if (!c.rows[0]) throw new HttpError(400, 'La campaña indicada no existe.');
    if (!c.rows[0].verificada) throw new HttpError(409, 'Solo puedes asociar campañas verificadas.');
  }
  const r = await query(
    `INSERT INTO ayudas (solicitud_id, tipo, cantidad, registrada_por, campana_id)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, tipo, cantidad, fecha_entrega AS "fechaEntrega", campana_id AS "campanaId"`,
    [id, tipo, cantidad, req.user.id, campanaId ?? null]);
  res.status(201).json(r.rows[0]);
});

export default router;
