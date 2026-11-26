// Crea las tablas, carga datos iniciales y crea el usuario administrador.
// Uso: npm run db:setup
import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { DATABASE_URL, ADMIN_CORREO, ADMIN_CLAVE } = process.env;
if (!DATABASE_URL) throw new Error('Falta DATABASE_URL en .env');
if (!ADMIN_CORREO || !ADMIN_CLAVE) throw new Error('Faltan ADMIN_CORREO / ADMIN_CLAVE en .env');

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
try {
  await client.query(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  await client.query(readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8'));
  const hash = await bcrypt.hash(ADMIN_CLAVE, 10);
  await client.query(
    `INSERT INTO usuarios (nombre, correo, clave_hash, rol)
     VALUES ('Administrador', $1, $2, 'administrador')
     ON CONFLICT (correo) DO NOTHING`,
    [ADMIN_CORREO.toLowerCase(), hash],
  );
  console.log('Base de datos lista. Admin:', ADMIN_CORREO.toLowerCase());
} finally {
  await client.end();
}
