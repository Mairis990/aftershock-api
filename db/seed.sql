-- Datos iniciales. Las campañas son de EJEMPLO para la demostración académica.
INSERT INTO necesidades (nombre) VALUES
  ('Alimentación'), ('Agua'), ('Medicamentos'),
  ('Atención médica'), ('Vivienda'), ('Ropa y abrigo')
ON CONFLICT (nombre) DO NOTHING;

DO $$
DECLARE c1 integer; c2 integer; c3 integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM campanas) THEN
    INSERT INTO campanas (nombre, descripcion, verificada, meta, recaudo, entidad_responsable)
    VALUES ('Alimentos para familias afectadas',
            'Mercados y alimentos no perecederos para familias que perdieron su vivienda.',
            true, 50000000, 12500000, 'Cruz Roja (ejemplo)') RETURNING id INTO c1;
    INSERT INTO campana_destinos (campana_id, concepto, porcentaje) VALUES
      (c1, 'Compra de alimentos', 80), (c1, 'Transporte y logística', 20);

    INSERT INTO campanas (nombre, descripcion, verificada, meta, recaudo, entidad_responsable)
    VALUES ('Reconstrucción de viviendas',
            'Materiales y mano de obra para reparar viviendas con daños estructurales.',
            true, 120000000, 30000000, 'Fundación Techo Seguro (ejemplo)') RETURNING id INTO c2;
    INSERT INTO campana_destinos (campana_id, concepto, porcentaje) VALUES
      (c2, 'Materiales', 60), (c2, 'Mano de obra', 30), (c2, 'Gestión', 10);

    INSERT INTO campanas (nombre, descripcion, verificada, meta, recaudo, entidad_responsable)
    VALUES ('Kits de higiene (en revisión)',
            'Campaña pendiente de verificación por el equipo administrador.',
            false, 15000000, 0, 'Colectivo Vecinal (ejemplo)') RETURNING id INTO c3;
    INSERT INTO campana_destinos (campana_id, concepto, porcentaje) VALUES
      (c3, 'Kits de higiene', 100);
  END IF;
END $$;

-- Campañas de ejemplo adicionales (solo si no existen)
DO $$
DECLARE cid integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM campanas WHERE nombre = 'Agua potable para comunidades') THEN
    INSERT INTO campanas (nombre, descripcion, verificada, meta, recaudo, entidad_responsable)
    VALUES ('Agua potable para comunidades',
            'Filtros y tanques para garantizar agua segura en barrios sin servicio.',
            true, 30000000, 4000000, 'Aguas Vivas (ejemplo)') RETURNING id INTO cid;
    INSERT INTO campana_destinos (campana_id, concepto, porcentaje) VALUES
      (cid, 'Filtros y tanques', 70), (cid, 'Logística', 30);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM campanas WHERE nombre = 'Medicinas para familias afectadas') THEN
    INSERT INTO campanas (nombre, descripcion, verificada, meta, recaudo, entidad_responsable)
    VALUES ('Medicinas para familias afectadas',
            'Medicamentos básicos y botiquines para personas con tratamientos interrumpidos.',
            true, 20000000, 2500000, 'Farmacia Solidaria (ejemplo)') RETURNING id INTO cid;
    INSERT INTO campana_destinos (campana_id, concepto, porcentaje) VALUES
      (cid, 'Medicamentos', 85), (cid, 'Transporte', 15);
  END IF;
END $$;

-- Ligar las campañas de ejemplo a su necesidad (solo si aún no tienen una)
UPDATE campanas SET necesidad_id = (SELECT id FROM necesidades WHERE nombre = 'Alimentación')
  WHERE nombre = 'Alimentos para familias afectadas' AND necesidad_id IS NULL;
UPDATE campanas SET necesidad_id = (SELECT id FROM necesidades WHERE nombre = 'Vivienda')
  WHERE nombre = 'Reconstrucción de viviendas' AND necesidad_id IS NULL;
UPDATE campanas SET necesidad_id = (SELECT id FROM necesidades WHERE nombre = 'Agua')
  WHERE nombre = 'Agua potable para comunidades' AND necesidad_id IS NULL;
UPDATE campanas SET necesidad_id = (SELECT id FROM necesidades WHERE nombre = 'Medicamentos')
  WHERE nombre = 'Medicinas para familias afectadas' AND necesidad_id IS NULL;

-- Ubicaciones de ejemplo repartidas por Colombia (solo si aún no tienen una)
UPDATE campanas SET latitud = 4.6486,  longitud = -74.1530, direccion = 'Kennedy, Bogotá'
  WHERE nombre = 'Alimentos para familias afectadas' AND latitud IS NULL;
UPDATE campanas SET latitud = 4.7410,  longitud = -74.0830, direccion = 'Suba, Bogotá'
  WHERE nombre = 'Medicinas para familias afectadas' AND latitud IS NULL;
UPDATE campanas SET latitud = 6.2518,  longitud = -75.5636, direccion = 'Centro, Medellín'
  WHERE nombre = 'Reconstrucción de viviendas' AND latitud IS NULL;
UPDATE campanas SET latitud = 10.9685, longitud = -74.7813, direccion = 'Barranquilla, Atlántico'
  WHERE nombre = 'Agua potable para comunidades' AND latitud IS NULL;
UPDATE campanas SET latitud = 3.4516,  longitud = -76.5320, direccion = 'Cali, Valle del Cauca'
  WHERE nombre = 'Kits de higiene (en revisión)' AND latitud IS NULL;
