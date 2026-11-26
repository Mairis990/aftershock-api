-- Aftershock · esquema de base de datos (PostgreSQL / Neon)
-- Se puede ejecutar varias veces sin romper nada (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS usuarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  correo      text NOT NULL UNIQUE,            -- siempre en minúsculas
  clave_hash  text NOT NULL,
  rol         text NOT NULL CHECK (rol IN ('afectada','donante','administrador')),
  creado_en   timestamptz NOT NULL DEFAULT now()
);

-- Perfil de la persona afectada (RF02): datos básicos y ubicación.
CREATE TABLE IF NOT EXISTS perfiles (
  usuario_id     uuid PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  documento      text NOT NULL UNIQUE,
  telefono       text NOT NULL,
  ubicacion      text NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS necesidades (
  id     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS solicitudes (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id      uuid NOT NULL REFERENCES usuarios(id),
  estado          text NOT NULL DEFAULT 'Pendiente'
                  CHECK (estado IN ('Pendiente','En revisión','En proceso','Atendida','Rechazada','Cancelada')),
  urgencia        text NOT NULL DEFAULT 'normal' CHECK (urgencia IN ('normal','urgente','critica')),
  otra_necesidad  text,
  descripcion     text,
  motivo_rechazo  text,
  confirmada_en   timestamptz,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS solicitudes_usuario_idx ON solicitudes(usuario_id);
CREATE INDEX IF NOT EXISTS solicitudes_estado_idx  ON solicitudes(estado);

CREATE TABLE IF NOT EXISTS solicitud_necesidades (
  solicitud_id integer NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  necesidad_id integer NOT NULL REFERENCES necesidades(id),
  PRIMARY KEY (solicitud_id, necesidad_id)
);

-- Historial de cambios de estado (trazabilidad).
CREATE TABLE IF NOT EXISTS solicitud_historial (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitud_id    integer NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  estado_anterior text,
  estado_nuevo    text NOT NULL,
  motivo          text,
  admin_id        uuid REFERENCES usuarios(id),
  fecha           timestamptz NOT NULL DEFAULT now()
);

-- Ayudas entregadas (RF10).
CREATE TABLE IF NOT EXISTS ayudas (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitud_id   integer NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  tipo           text NOT NULL,
  cantidad       integer NOT NULL CHECK (cantidad > 0),
  registrada_por uuid REFERENCES usuarios(id),
  fecha_entrega  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campanas (
  id                  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre              text NOT NULL,
  descripcion         text NOT NULL,
  verificada          boolean NOT NULL DEFAULT false,
  meta                bigint NOT NULL CHECK (meta > 0),
  recaudo             bigint NOT NULL DEFAULT 0 CHECK (recaudo >= 0),
  entidad_responsable text NOT NULL,
  creado_en           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campana_destinos (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campana_id  integer NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
  concepto    text NOT NULL,
  porcentaje  integer NOT NULL CHECK (porcentaje BETWEEN 1 AND 100)
);

-- Donaciones SIMULADAS: no hay cobro real.
CREATE TABLE IF NOT EXISTS donaciones (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  uuid NOT NULL REFERENCES usuarios(id),
  campana_id  integer NOT NULL REFERENCES campanas(id),
  monto       bigint NOT NULL CHECK (monto > 0),
  metodo_pago text NOT NULL CHECK (metodo_pago IN ('Tarjeta','PSE','Transferencia')),
  estado      text NOT NULL DEFAULT 'Simulada',
  creado_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS donaciones_usuario_idx ON donaciones(usuario_id);

-- ---- Migración para bases creadas con la versión anterior (se puede repetir) ----
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS urgencia text NOT NULL DEFAULT 'normal';
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS otra_necesidad text;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS confirmada_en timestamptz;
ALTER TABLE solicitudes DROP CONSTRAINT IF EXISTS solicitudes_estado_check;
ALTER TABLE solicitudes ADD CONSTRAINT solicitudes_estado_check
  CHECK (estado IN ('Pendiente','En revisión','En proceso','Atendida','Rechazada','Cancelada'));
ALTER TABLE solicitudes DROP CONSTRAINT IF EXISTS solicitudes_urgencia_check;
ALTER TABLE solicitudes ADD CONSTRAINT solicitudes_urgencia_check
  CHECK (urgencia IN ('normal','urgente','critica'));

-- ---- Campañas ligadas a necesidades y ayudas ligadas a campañas ----
ALTER TABLE campanas ADD COLUMN IF NOT EXISTS necesidad_id integer REFERENCES necesidades(id);
ALTER TABLE ayudas   ADD COLUMN IF NOT EXISTS campana_id   integer REFERENCES campanas(id);

-- ---- Ubicación de las campañas (para el mapa del donante) ----
ALTER TABLE campanas ADD COLUMN IF NOT EXISTS latitud  double precision;
ALTER TABLE campanas ADD COLUMN IF NOT EXISTS longitud double precision;
ALTER TABLE campanas ADD COLUMN IF NOT EXISTS direccion text;
ALTER TABLE campanas DROP CONSTRAINT IF EXISTS campanas_ubicacion_check;
ALTER TABLE campanas ADD CONSTRAINT campanas_ubicacion_check CHECK (
  (latitud IS NULL AND longitud IS NULL) OR
  (latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180));
