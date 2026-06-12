
-- Penca Mundial 2026 - Schema & Seed Data
-- Execute this script in the Supabase SQL Editor.

-- Drop triggers, views and tables if they exist to start fresh
DROP TRIGGER IF EXISTS trigger_verificar_inscripciones ON participantes;
DROP FUNCTION IF EXISTS verificar_inscripciones_abiertas();
DROP FUNCTION IF EXISTS finalizar_partido_seguro(INT, INT, INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS reabrir_partido_seguro(INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS actualizar_configuracion_segura(TEXT, TEXT, TEXT);
DROP VIEW IF EXISTS ranking;
DROP TABLE IF EXISTS puntuaciones;
DROP TABLE IF EXISTS pronosticos;
DROP TABLE IF EXISTS partidos;
DROP TABLE IF EXISTS participantes;
DROP TABLE IF EXISTS configuracion;

-- 1. Tablas principales
CREATE TABLE participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) UNIQUE NOT NULL,
  campeon VARCHAR(255) NOT NULL,
  subcampeon VARCHAR(255) NOT NULL,
  bloqueado BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE partidos (
  id INTEGER PRIMARY KEY,
  fecha DATE NOT NULL,
  hora VARCHAR(50) NOT NULL,
  grupo VARCHAR(100) NOT NULL,
  equipo_local VARCHAR(255) NOT NULL,
  equipo_visitante VARCHAR(255) NOT NULL,
  goles_local_real INTEGER,
  goles_visitante_real INTEGER,
  equipo_ganador VARCHAR(255),
  equipo_perdedor VARCHAR(255),
  estado VARCHAR(50) DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'En juego', 'Finalizado'))
);

CREATE TABLE pronosticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id UUID REFERENCES participantes(id) ON DELETE CASCADE,
  partido_id INTEGER REFERENCES partidos(id) ON DELETE CASCADE,
  goles_local INTEGER NOT NULL,
  goles_visitante INTEGER NOT NULL,
  UNIQUE(participante_id, partido_id)
);

CREATE TABLE puntuaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participante_id UUID REFERENCES participantes(id) ON DELETE CASCADE,
  partido_id INTEGER REFERENCES partidos(id) ON DELETE CASCADE,
  puntos INTEGER NOT NULL,
  UNIQUE(participante_id, partido_id)
);

CREATE TABLE configuracion (
  clave VARCHAR(255) PRIMARY KEY,
  valor VARCHAR(255)
);

-- 2. Índices para rendimiento
CREATE INDEX idx_pronosticos_participante ON pronosticos(participante_id);
CREATE INDEX idx_puntuaciones_participante ON puntuaciones(participante_id);
CREATE INDEX idx_partidos_estado ON partidos(estado);

-- 3. Habilitar RLS (Seguridad a Nivel de Fila)
ALTER TABLE participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE partidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pronosticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE puntuaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública (todo el mundo puede leer el ranking y pronósticos)
CREATE POLICY "Lectura pública de participantes" ON participantes FOR SELECT USING (true);
CREATE POLICY "Lectura pública de partidos" ON partidos FOR SELECT USING (true);
CREATE POLICY "Lectura pública de pronosticos" ON pronosticos FOR SELECT USING (true);
CREATE POLICY "Lectura pública de puntuaciones" ON puntuaciones FOR SELECT USING (true);
CREATE POLICY "Lectura pública de configuracion" ON configuracion FOR SELECT USING (true);

-- Políticas de escritura pública para registrar participante y sus pronósticos
CREATE POLICY "Inserción pública de participantes" ON participantes FOR INSERT WITH CHECK (true);
CREATE POLICY "Inserción pública de pronosticos" ON pronosticos FOR INSERT WITH CHECK (true);

-- No se definen políticas de UPDATE/DELETE para partidos, configuracion y puntuaciones,
-- por lo que cualquier modificación mediante la API anon de Supabase queda totalmente DENEGADA.
-- Todas las modificaciones administrativas deberán canalizarse a través de las funciones RPC seguras.

-- 4. Funciones y Triggers en la base de datos
-- Función segura para finalizar un partido y calcular automáticamente los puntos
CREATE OR REPLACE FUNCTION finalizar_partido_seguro(
  p_partido_id INT,
  p_goles_local INT,
  p_goles_visitante INT,
  p_ganador TEXT,
  p_password TEXT
) RETURNS VOID AS $$
DECLARE
  v_correct_password TEXT;
  r RECORD;
  v_puntos INT;
  v_local TEXT;
  v_visitante TEXT;
  v_ganador_equipo TEXT;
  v_perdedor_equipo TEXT;
BEGIN
  -- 1. Verificar contraseña a través del parámetro de sesión app.admin_password o por defecto admin123
  -- Para cambiar la contraseña de administración, ejecuta en el editor SQL:
  -- ALTER ROLE authenticator SET app.admin_password = 'nueva_contraseña';
  v_correct_password := COALESCE(current_setting('app.admin_password', true), 'admin123');
  
  IF p_password <> v_correct_password THEN
    RAISE EXCEPTION 'Contraseña de administrador incorrecta. No autorizado.';
  END IF;

  -- 2. Obtener los equipos del partido
  SELECT equipo_local, equipo_visitante INTO v_local, v_visitante FROM partidos WHERE id = p_partido_id;

  -- 3. Calcular ganador y perdedor reales (soporta penaltis si es empate en eliminatoria)
  IF p_goles_local > p_goles_visitante THEN
    v_ganador_equipo := v_local;
    v_perdedor_equipo := v_visitante;
  ELSIF p_goles_local < p_goles_visitante THEN
    v_ganador_equipo := v_visitante;
    v_perdedor_equipo := v_local;
  ELSE
    -- Empate
    IF p_ganador IS NOT NULL AND p_ganador <> '' THEN
      v_ganador_equipo := p_ganador;
      IF p_ganador = v_local THEN
        v_perdedor_equipo := v_visitante;
      ELSE
        v_perdedor_equipo := v_local;
      END IF;
    ELSE
      v_ganador_equipo := NULL;
      v_perdedor_equipo := NULL;
    END IF;
  END IF;

  -- 4. Actualizar el partido
  UPDATE partidos
  SET goles_local_real = p_goles_local,
      goles_visitante_real = p_goles_visitante,
      estado = 'Finalizado',
      equipo_ganador = v_ganador_equipo,
      equipo_perdedor = v_perdedor_equipo
  WHERE id = p_partido_id;

  -- 5. Eliminar puntuaciones previas de este partido
  DELETE FROM puntuaciones WHERE partido_id = p_partido_id;

  -- 6. Calcular e insertar nuevas puntuaciones para todos los pronósticos de este partido
  FOR r IN (SELECT participante_id, goles_local, goles_visitante FROM pronosticos WHERE partido_id = p_partido_id) LOOP
    IF r.goles_local = p_goles_local AND r.goles_visitante = p_goles_visitante THEN
      v_puntos := 3;
    ELSIF sign(r.goles_local - r.goles_visitante) = sign(p_goles_local - p_goles_visitante) THEN
      v_puntos := 1;
    ELSE
      v_puntos := 0;
    END IF;

    INSERT INTO puntuaciones (participante_id, partido_id, puntos)
    VALUES (r.participante_id, p_partido_id, v_puntos);
  END LOOP;

  -- 7. Resolver cruces eliminatorios automáticos
  IF v_ganador_equipo IS NOT NULL THEN
    -- Actualizar locales
    UPDATE partidos
    SET equipo_local = v_ganador_equipo
    WHERE equipo_local = 'Ganador ' || p_partido_id;

    UPDATE partidos
    SET equipo_local = v_perdedor_equipo
    WHERE equipo_local = 'Perdedor ' || p_partido_id;

    -- Actualizar visitantes
    UPDATE partidos
    SET equipo_visitante = v_ganador_equipo
    WHERE equipo_visitante = 'Ganador ' || p_partido_id;

    UPDATE partidos
    SET equipo_visitante = v_perdedor_equipo
    WHERE equipo_visitante = 'Perdedor ' || p_partido_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función segura para reabrir un partido
CREATE OR REPLACE FUNCTION reabrir_partido_seguro(
  p_partido_id INT,
  p_nuevo_estado TEXT,
  p_password TEXT
) RETURNS VOID AS $$
DECLARE
  v_correct_password TEXT;
  v_ganador TEXT;
  v_perdedor TEXT;
BEGIN
  -- 1. Verificar contraseña
  v_correct_password := COALESCE(current_setting('app.admin_password', true), 'admin123');
  IF p_password <> v_correct_password THEN
    RAISE EXCEPTION 'Contraseña de administrador incorrecta. No autorizado.';
  END IF;

  -- 2. Obtener ganador y perdedor previos para revertir en partidos futuros
  SELECT equipo_ganador, equipo_perdedor INTO v_ganador, v_perdedor FROM partidos WHERE id = p_partido_id;

  -- 3. Revertir cruces eliminatorios automáticos
  IF v_ganador IS NOT NULL THEN
    UPDATE partidos
    SET equipo_local = 'Ganador ' || p_partido_id
    WHERE equipo_local = v_ganador;

    UPDATE partidos
    SET equipo_visitante = 'Ganador ' || p_partido_id
    WHERE equipo_visitante = v_ganador;
  END IF;

  IF v_perdedor IS NOT NULL THEN
    UPDATE partidos
    SET equipo_local = 'Perdedor ' || p_partido_id
    WHERE equipo_local = v_perdedor;

    UPDATE partidos
    SET equipo_visitante = 'Perdedor ' || p_partido_id
    WHERE equipo_visitante = v_perdedor;
  END IF;

  -- 4. Limpiar marcador y estado del partido
  UPDATE partidos
  SET goles_local_real = NULL,
      goles_visitante_real = NULL,
      estado = p_nuevo_estado,
      equipo_ganador = NULL,
      equipo_perdedor = NULL
  WHERE id = p_partido_id;

  -- 5. Eliminar puntuaciones del partido
  DELETE FROM puntuaciones WHERE partido_id = p_partido_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función segura para guardar configuraciones administrativas
CREATE OR REPLACE FUNCTION actualizar_configuracion_segura(
  p_clave TEXT,
  p_valor TEXT,
  p_password TEXT
) RETURNS VOID AS $$
DECLARE
  v_correct_password TEXT;
BEGIN
  -- 1. Verificar contraseña
  v_correct_password := COALESCE(current_setting('app.admin_password', true), 'admin123');
  IF p_password <> v_correct_password THEN
    RAISE EXCEPTION 'Contraseña de administrador incorrecta. No autorizado.';
  END IF;

  -- 2. Insertar o actualizar valor
  INSERT INTO configuracion (clave, valor)
  VALUES (p_clave, p_valor)
  ON CONFLICT (clave) DO UPDATE SET valor = p_valor;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función de trigger para evitar registros después del inicio del torneo (Partido 1)
CREATE OR REPLACE FUNCTION verificar_inscripciones_abiertas()
RETURNS TRIGGER AS $$
DECLARE
  v_primer_partido_fecha DATE;
  v_primer_partido_hora TIME;
  v_primer_partido_timestamp TIMESTAMPTZ;
BEGIN
  SELECT fecha, hora::TIME INTO v_primer_partido_fecha, v_primer_partido_hora
  FROM partidos
  WHERE id = 1;

  IF v_primer_partido_fecha IS NOT NULL AND v_primer_partido_hora IS NOT NULL THEN
    -- El primer partido se asume guardado con hora UTC
    v_primer_partido_timestamp := (v_primer_partido_fecha + v_primer_partido_hora) AT TIME ZONE 'UTC';
    
    IF NOW() >= v_primer_partido_timestamp THEN
      RAISE EXCEPTION 'Las inscripciones para la Penca Mundial 2026 ya se encuentran cerradas.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_verificar_inscripciones
BEFORE INSERT ON participantes
FOR EACH ROW
EXECUTE FUNCTION verificar_inscripciones_abiertas();

-- 5. Vista de ranking automático
CREATE OR REPLACE VIEW ranking AS
WITH stats AS (
  SELECT
    p.id AS participante_id,
    p.nombre,
    p.campeon,
    p.subcampeon,
    p.bloqueado,
    p.fecha_creacion,
    COALESCE(SUM(pt.puntos), 0) AS puntos_pronosticos,
    COALESCE(COUNT(CASE WHEN pt.puntos = 3 THEN 1 END), 0) AS exactos_acertados,
    COALESCE(COUNT(CASE WHEN pt.puntos = 1 THEN 1 END), 0) AS ganadores_acertados
  FROM participantes p
  LEFT JOIN puntuaciones pt ON p.id = pt.participante_id
  GROUP BY p.id, p.nombre, p.campeon, p.subcampeon, p.bloqueado, p.fecha_creacion
),
real_results AS (
  SELECT
    (SELECT valor FROM configuracion WHERE clave = 'campeon_real') AS campeon_real,
    (SELECT valor FROM configuracion WHERE clave = 'subcampeon_real') AS subcampeon_real
)
SELECT
  s.participante_id,
  s.nombre,
  s.campeon,
  s.subcampeon,
  s.bloqueado,
  s.fecha_creacion,
  s.puntos_pronosticos,
  s.exactos_acertados,
  s.ganadores_acertados,
  CASE WHEN s.campeon = r.campeon_real THEN 10 ELSE 0 END AS puntos_campeon,
  CASE WHEN s.subcampeon = r.subcampeon_real THEN 5 ELSE 0 END AS puntos_subcampeon,
  (s.puntos_pronosticos + 
   (CASE WHEN s.campeon = r.campeon_real THEN 10 ELSE 0 END) + 
   (CASE WHEN s.subcampeon = r.subcampeon_real THEN 5 ELSE 0 END)
  ) AS puntos_totales
FROM stats s, real_results r
ORDER BY
  puntos_totales DESC,
  s.exactos_acertados DESC,
  s.ganadores_acertados DESC,
  s.nombre ASC;

-- 6. Insertar configuración inicial (Ya NO se inserta admin_password aquí)
INSERT INTO configuracion (clave, valor) VALUES 
('campeon_real', NULL),
('subcampeon_real', NULL)
ON CONFLICT (clave) DO NOTHING;

-- 7. Precargar partidos
INSERT INTO partidos (id, fecha, hora, grupo, equipo_local, equipo_visitante, goles_local_real, goles_visitante_real, equipo_ganador, equipo_perdedor, estado) VALUES
(1, '2026-06-11', '19:00', 'Grupo A', 'Mexico', 'South Africa', NULL, NULL, NULL, NULL, 'Pendiente'),
(2, '2026-06-12', '02:00', 'Grupo A', 'South Korea', 'Czech Republic', NULL, NULL, NULL, NULL, 'Pendiente'),
(3, '2026-06-12', '19:00', 'Grupo B', 'Canada', 'Bosnia and Herzegovina', NULL, NULL, NULL, NULL, 'Pendiente'),
(4, '2026-06-13', '01:00', 'Grupo D', 'United States', 'Paraguay', NULL, NULL, NULL, NULL, 'Pendiente'),
(5, '2026-06-14', '01:00', 'Grupo C', 'Scotland', 'Haiti', NULL, NULL, NULL, NULL, 'Pendiente'),
(6, '2026-06-14', '04:00', 'Grupo D', 'Australia', 'Turkey', NULL, NULL, NULL, NULL, 'Pendiente'),
(7, '2026-06-13', '22:00', 'Grupo C', 'Brazil', 'Morocco', NULL, NULL, NULL, NULL, 'Pendiente'),
(8, '2026-06-13', '19:00', 'Grupo B', 'Switzerland', 'Qatar', NULL, NULL, NULL, NULL, 'Pendiente'),
(9, '2026-06-14', '23:00', 'Grupo E', 'Ivory Coast', 'Ecuador', NULL, NULL, NULL, NULL, 'Pendiente'),
(10, '2026-06-14', '17:00', 'Grupo E', 'Germany', 'Curacao', NULL, NULL, NULL, NULL, 'Pendiente'),
(11, '2026-06-14', '20:00', 'Grupo F', 'Netherlands', 'Japan', NULL, NULL, NULL, NULL, 'Pendiente'),
(12, '2026-06-15', '02:00', 'Grupo F', 'Sweden', 'Tunisia', NULL, NULL, NULL, NULL, 'Pendiente'),
(13, '2026-06-16', '01:00', 'Grupo H', 'Uruguay', 'Saudi Arabia', NULL, NULL, NULL, NULL, 'Pendiente'),
(14, '2026-06-15', '16:00', 'Grupo H', 'Spain', 'Cape Verde', NULL, NULL, NULL, NULL, 'Pendiente'),
(15, '2026-06-15', '19:00', 'Grupo G', 'Iran', 'New Zealand', NULL, NULL, NULL, NULL, 'Pendiente'),
(16, '2026-06-15', '22:00', 'Grupo G', 'Belgium', 'Egypt', NULL, NULL, NULL, NULL, 'Pendiente'),
(17, '2026-06-16', '19:00', 'Grupo I', 'France', 'Senegal', NULL, NULL, NULL, NULL, 'Pendiente'),
(18, '2026-06-16', '22:00', 'Grupo I', 'Norway', 'Iraq', NULL, NULL, NULL, NULL, 'Pendiente'),
(19, '2026-06-17', '01:00', 'Grupo J', 'Argentina', 'Algeria', NULL, NULL, NULL, NULL, 'Pendiente'),
(20, '2026-06-17', '04:00', 'Grupo J', 'Austria', 'Jordan', NULL, NULL, NULL, NULL, 'Pendiente'),
(21, '2026-06-17', '17:00', 'Grupo L', 'Panama', 'Ghana', NULL, NULL, NULL, NULL, 'Pendiente'),
(22, '2026-06-17', '20:00', 'Grupo L', 'England', 'Croatia', NULL, NULL, NULL, NULL, 'Pendiente'),
(23, '2026-06-18', '02:00', 'Grupo K', 'Portugal', 'DR Congo', NULL, NULL, NULL, NULL, 'Pendiente'),
(24, '2026-06-17', '23:00', 'Grupo K', 'Colombia', 'Uzbekistan', NULL, NULL, NULL, NULL, 'Pendiente'),
(25, '2026-06-19', '01:00', 'Grupo A', 'South Africa', 'Czech Republic', NULL, NULL, NULL, NULL, 'Pendiente'),
(26, '2026-06-18', '19:00', 'Grupo B', 'Switzerland', 'Bosnia and Herzegovina', NULL, NULL, NULL, NULL, 'Pendiente'),
(27, '2026-06-18', '22:00', 'Grupo B', 'Canada', 'Qatar', NULL, NULL, NULL, NULL, 'Pendiente'),
(28, '2026-06-18', '16:00', 'Grupo A', 'Mexico', 'South Korea', NULL, NULL, NULL, NULL, 'Pendiente'),
(29, '2026-06-20', '01:00', 'Grupo C', 'Brazil', 'Haiti', NULL, NULL, NULL, NULL, 'Pendiente'),
(30, '2026-06-19', '22:00', 'Grupo C', 'Morocco', 'Scotland', NULL, NULL, NULL, NULL, 'Pendiente'),
(31, '2026-06-19', '19:00', 'Grupo D', 'Paraguay', 'Turkey', NULL, NULL, NULL, NULL, 'Pendiente'),
(32, '2026-06-20', '03:00', 'Grupo D', 'United States', 'Australia', NULL, NULL, NULL, NULL, 'Pendiente'),
(33, '2026-06-20', '20:00', 'Grupo E', 'Germany', 'Ivory Coast', NULL, NULL, NULL, NULL, 'Pendiente'),
(34, '2026-06-21', '00:00', 'Grupo E', 'Ecuador', 'Curacao', NULL, NULL, NULL, NULL, 'Pendiente'),
(35, '2026-06-20', '17:00', 'Grupo F', 'Netherlands', 'Sweden', NULL, NULL, NULL, NULL, 'Pendiente'),
(36, '2026-06-21', '04:00', 'Grupo F', 'Japan', 'Tunisia', NULL, NULL, NULL, NULL, 'Pendiente'),
(37, '2026-06-21', '19:00', 'Grupo H', 'Uruguay', 'Cape Verde', NULL, NULL, NULL, NULL, 'Pendiente'),
(38, '2026-06-22', '01:00', 'Grupo H', 'Spain', 'Saudi Arabia', NULL, NULL, NULL, NULL, 'Pendiente'),
(39, '2026-06-21', '16:00', 'Grupo G', 'Belgium', 'Iran', NULL, NULL, NULL, NULL, 'Pendiente'),
(40, '2026-06-21', '22:00', 'Grupo G', 'Egypt', 'New Zealand', NULL, NULL, NULL, NULL, 'Pendiente'),
(41, '2026-06-22', '21:00', 'Grupo I', 'Senegal', 'Norway', NULL, NULL, NULL, NULL, 'Pendiente'),
(42, '2026-06-23', '00:00', 'Grupo I', 'France', 'Iraq', NULL, NULL, NULL, NULL, 'Pendiente'),
(43, '2026-06-22', '17:00', 'Grupo J', 'Argentina', 'Austria', NULL, NULL, NULL, NULL, 'Pendiente'),
(44, '2026-06-23', '03:00', 'Grupo J', 'Algeria', 'Jordan', NULL, NULL, NULL, NULL, 'Pendiente'),
(45, '2026-06-23', '17:00', 'Grupo L', 'England', 'Ghana', NULL, NULL, NULL, NULL, 'Pendiente'),
(46, '2026-06-23', '23:00', 'Grupo L', 'Croatia', 'Panama', NULL, NULL, NULL, NULL, 'Pendiente'),
(47, '2026-06-24', '02:00', 'Grupo K', 'Portugal', 'Uzbekistan', NULL, NULL, NULL, NULL, 'Pendiente'),
(48, '2026-06-23', '20:00', 'Grupo K', 'Colombia', 'DR Congo', NULL, NULL, NULL, NULL, 'Pendiente'),
(49, '2026-06-24', '22:00', 'Grupo C', 'Brazil', 'Scotland', NULL, NULL, NULL, NULL, 'Pendiente'),
(50, '2026-06-24', '22:00', 'Grupo C', 'Morocco', 'Haiti', NULL, NULL, NULL, NULL, 'Pendiente'),
(51, '2026-06-25', '01:00', 'Grupo B', 'Canada', 'Switzerland', NULL, NULL, NULL, NULL, 'Pendiente'),
(52, '2026-06-25', '01:00', 'Grupo B', 'Qatar', 'Bosnia and Herzegovina', NULL, NULL, NULL, NULL, 'Pendiente'),
(53, '2026-06-24', '19:00', 'Grupo A', 'Mexico', 'Czech Republic', NULL, NULL, NULL, NULL, 'Pendiente'),
(54, '2026-06-24', '19:00', 'Grupo A', 'South Africa', 'South Korea', NULL, NULL, NULL, NULL, 'Pendiente'),
(55, '2026-06-25', '20:00', 'Grupo E', 'Ivory Coast', 'Curacao', NULL, NULL, NULL, NULL, 'Pendiente'),
(56, '2026-06-25', '20:00', 'Grupo E', 'Germany', 'Ecuador', NULL, NULL, NULL, NULL, 'Pendiente'),
(57, '2026-06-26', '02:00', 'Grupo F', 'Japan', 'Sweden', NULL, NULL, NULL, NULL, 'Pendiente'),
(58, '2026-06-26', '02:00', 'Grupo F', 'Netherlands', 'Tunisia', NULL, NULL, NULL, NULL, 'Pendiente'),
(59, '2026-06-25', '23:00', 'Grupo D', 'United States', 'Turkey', NULL, NULL, NULL, NULL, 'Pendiente'),
(60, '2026-06-25', '23:00', 'Grupo D', 'Australia', 'Paraguay', NULL, NULL, NULL, NULL, 'Pendiente'),
(61, '2026-06-26', '19:00', 'Grupo I', 'France', 'Norway', NULL, NULL, NULL, NULL, 'Pendiente'),
(62, '2026-06-26', '19:00', 'Grupo I', 'Senegal', 'Iraq', NULL, NULL, NULL, NULL, 'Pendiente'),
(63, '2026-06-27', '03:00', 'Grupo G', 'Iran', 'Egypt', NULL, NULL, NULL, NULL, 'Pendiente'),
(64, '2026-06-27', '03:00', 'Grupo G', 'Belgium', 'New Zealand', NULL, NULL, NULL, NULL, 'Pendiente'),
(65, '2026-06-27', '00:00', 'Grupo H', 'Saudi Arabia', 'Cape Verde', NULL, NULL, NULL, NULL, 'Pendiente'),
(66, '2026-06-27', '00:00', 'Grupo H', 'Spain', 'Uruguay', NULL, NULL, NULL, NULL, 'Pendiente'),
(67, '2026-06-27', '21:00', 'Grupo L', 'England', 'Panama', NULL, NULL, NULL, NULL, 'Pendiente'),
(68, '2026-06-27', '21:00', 'Grupo L', 'Croatia', 'Ghana', NULL, NULL, NULL, NULL, 'Pendiente'),
(69, '2026-06-28', '02:00', 'Grupo J', 'Austria', 'Algeria', NULL, NULL, NULL, NULL, 'Pendiente'),
(70, '2026-06-28', '02:00', 'Grupo J', 'Argentina', 'Jordan', NULL, NULL, NULL, NULL, 'Pendiente'),
(71, '2026-06-27', '23:30', 'Grupo K', 'Portugal', 'Colombia', NULL, NULL, NULL, NULL, 'Pendiente'),
(72, '2026-06-27', '23:30', 'Grupo K', 'Uzbekistan', 'DR Congo', NULL, NULL, NULL, NULL, 'Pendiente'),
(73, '2026-06-28', '19:00', 'Dieciseisavos', '2° A', '2° B', NULL, NULL, NULL, NULL, 'Pendiente'),
(74, '2026-06-29', '20:30', 'Dieciseisavos', '1° E', '3° ABCDF', NULL, NULL, NULL, NULL, 'Pendiente'),
(75, '2026-06-30', '01:00', 'Dieciseisavos', '1° F', '2° C', NULL, NULL, NULL, NULL, 'Pendiente'),
(76, '2026-06-29', '17:00', 'Dieciseisavos', '1° C', '2° F', NULL, NULL, NULL, NULL, 'Pendiente'),
(77, '2026-06-30', '21:00', 'Dieciseisavos', '1° I', '3° CDFGH', NULL, NULL, NULL, NULL, 'Pendiente'),
(78, '2026-06-30', '17:00', 'Dieciseisavos', '2° E', '2° I', NULL, NULL, NULL, NULL, 'Pendiente'),
(79, '2026-07-01', '01:00', 'Dieciseisavos', '1° A', '3° CEFHI', NULL, NULL, NULL, NULL, 'Pendiente'),
(80, '2026-07-01', '16:00', 'Dieciseisavos', '1° L', '3° EHIJK', NULL, NULL, NULL, NULL, 'Pendiente'),
(81, '2026-07-02', '00:00', 'Dieciseisavos', '1° D', '3° BEFIJ', NULL, NULL, NULL, NULL, 'Pendiente'),
(82, '2026-07-01', '20:00', 'Dieciseisavos', '1° G', '3° AEHIJ', NULL, NULL, NULL, NULL, 'Pendiente'),
(83, '2026-07-02', '23:00', 'Dieciseisavos', '2° K', '2° L', NULL, NULL, NULL, NULL, 'Pendiente'),
(84, '2026-07-02', '19:00', 'Dieciseisavos', '1° H', '2° J', NULL, NULL, NULL, NULL, 'Pendiente'),
(85, '2026-07-03', '03:00', 'Dieciseisavos', '1° B', '3° EFGIJ', NULL, NULL, NULL, NULL, 'Pendiente'),
(86, '2026-07-03', '22:00', 'Dieciseisavos', '1° J', '2° H', NULL, NULL, NULL, NULL, 'Pendiente'),
(87, '2026-07-04', '01:30', 'Dieciseisavos', '1° K', '3° DEIJL', NULL, NULL, NULL, NULL, 'Pendiente'),
(88, '2026-07-03', '18:00', 'Dieciseisavos', '2° D', '2° G', NULL, NULL, NULL, NULL, 'Pendiente'),
(89, '2026-07-04', '21:00', 'Octavos', 'Ganador 74', 'Ganador 77', NULL, NULL, NULL, NULL, 'Pendiente'),
(90, '2026-07-04', '17:00', 'Octavos', 'Ganador 73', 'Ganador 75', NULL, NULL, NULL, NULL, 'Pendiente'),
(91, '2026-07-05', '20:00', 'Octavos', 'Ganador 76', 'Ganador 78', NULL, NULL, NULL, NULL, 'Pendiente'),
(92, '2026-07-06', '00:00', 'Octavos', 'Ganador 79', 'Ganador 80', NULL, NULL, NULL, NULL, 'Pendiente'),
(93, '2026-07-06', '19:00', 'Octavos', 'Ganador 83', 'Ganador 84', NULL, NULL, NULL, NULL, 'Pendiente'),
(94, '2026-07-07', '00:00', 'Octavos', 'Ganador 81', 'Ganador 82', NULL, NULL, NULL, NULL, 'Pendiente'),
(95, '2026-07-07', '16:00', 'Octavos', 'Ganador 86', 'Ganador 88', NULL, NULL, NULL, NULL, 'Pendiente'),
(96, '2026-07-07', '20:00', 'Octavos', 'Ganador 85', 'Ganador 87', NULL, NULL, NULL, NULL, 'Pendiente'),
(97, '2026-07-09', '20:00', 'Cuartos', 'Ganador 89', 'Ganador 90', NULL, NULL, NULL, NULL, 'Pendiente'),
(98, '2026-07-10', '19:00', 'Cuartos', 'Ganador 93', 'Ganador 94', NULL, NULL, NULL, NULL, 'Pendiente'),
(99, '2026-07-11', '21:00', 'Cuartos', 'Ganador 91', 'Ganador 92', NULL, NULL, NULL, NULL, 'Pendiente'),
(100, '2026-07-12', '01:00', 'Cuartos', 'Ganador 95', 'Ganador 96', NULL, NULL, NULL, NULL, 'Pendiente'),
(101, '2026-07-14', '19:00', 'Semifinal', 'Ganador 97', 'Ganador 98', NULL, NULL, NULL, NULL, 'Pendiente'),
(102, '2026-07-15', '19:00', 'Semifinal', 'Ganador 99', 'Ganador 100', NULL, NULL, NULL, NULL, 'Pendiente'),
(103, '2026-07-18', '21:00', 'Tercer puesto', 'Perdedor 101', 'Perdedor 102', NULL, NULL, NULL, NULL, 'Pendiente'),
(104, '2026-07-19', '19:00', 'Final', 'Ganador 101', 'Ganador 102', NULL, NULL, NULL, NULL, 'Pendiente')
ON CONFLICT (id) DO NOTHING;
