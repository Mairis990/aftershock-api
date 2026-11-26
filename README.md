# Aftershock API

Backend (Node.js + Express) que conecta la app Flutter con la base de datos en Neon.

## Puesta en marcha (una sola vez)

1. **Instala Node.js 20 o superior** (https://nodejs.org, versión LTS). Comprueba con `node -v`.
2. **Crea la base en Neon:** neon.tech → New Project → entra al proyecto → botón **Connect** → copia la cadena
   de conexión (la que dice *pooled*). Se ve así: `postgresql://usuario:clave@ep-...neon.tech/neondb?sslmode=require`
3. En esta carpeta copia `.env.example` como `.env` y rellena `DATABASE_URL`, `JWT_SECRET` y la clave del admin.
   (PowerShell: `Copy-Item .env.example .env`)
4. Instala y crea las tablas:
   ```
   npm install
   npm run db:setup
   ```
5. Arranca el servidor: `npm run dev` → abre http://localhost:3000/api/v1/salud (debe mostrar `{"ok":true}`).

`npm run db:setup` se puede repetir sin problema: no borra datos.

## Endpoints (todos bajo /api/v1)

| Método | Ruta | Quién |
|---|---|---|
| POST | /auth/registro `{nombre, correo, clave, rol: afectada\|donante}` | público |
| POST | /auth/login `{correo, clave}` | público |
| GET | /me | sesión |
| PUT | /me/perfil `{documento, telefono, ubicacion}` | afectada |
| GET | /necesidades | público |
| POST | /solicitudes `{necesidades:[nombres], descripcion?}` | afectada |
| GET | /solicitudes/mias | afectada |
| GET | /solicitudes?estado= | administrador |
| GET | /solicitudes/:id | dueña o admin |
| PATCH | /solicitudes/:id/estado `{estado, motivo?}` | administrador |
| POST | /solicitudes/:id/ayudas `{tipo, cantidad}` | administrador |
| GET | /personas | administrador |
| GET | /campanas?estado=Verificada · /campanas/:id | público |
| POST | /campanas · PATCH /campanas/:id/verificar | administrador |
| POST | /donaciones `{campanaId, monto, metodoPago}` | donante |
| GET | /donaciones/mias | donante |

Las rutas protegidas usan el encabezado `Authorization: Bearer <token>`.
Errores: siempre `{ "error": "mensaje en español" }`.

## Despliegue (para usarlo desde el celular sin tu PC)

Render.com → New Web Service → conecta el repo → Build: `npm install` → Start: `npm start` →
agrega las variables `DATABASE_URL` y `JWT_SECRET` (las `ADMIN_*` solo se usan en `db:setup`).
Nunca subas el archivo `.env` a GitHub (ya está en `.gitignore`).
