import pg from 'pg';
import { config } from './config.js';

// bigint (campañas, montos) llega como texto desde pg: lo convertimos a número.
pg.types.setTypeParser(20, (v) => Number(v));

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 5 });

export const query = (texto, params) => pool.query(texto, params);

/** Ejecuta varias consultas en una transacción. */
export async function transaccion(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
