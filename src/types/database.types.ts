export interface Participante {
  id: string;
  nombre: string;
  campeon: string;
  subcampeon: string;
  bloqueado: boolean;
  fecha_creacion: string;
}

export interface Partido {
  id: number;
  fecha: string;
  hora: string;
  grupo: string;
  equipo_local: string;
  equipo_visitante: string;
  goles_local_real: number | null;
  goles_visitante_real: number | null;
  equipo_ganador: string | null;
  equipo_perdedor: string | null;
  estado: 'Pendiente' | 'En juego' | 'Finalizado';
}

export interface Pronostico {
  id: string;
  participante_id: string;
  partido_id: number;
  goles_local: number;
  goles_visitante: number;
}

export interface Puntuacion {
  id: string;
  participante_id: string;
  partido_id: number;
  puntos: number;
}

export interface Configuracion {
  clave: string;
  valor: string | null;
}

export interface RankingRow {
  participante_id: string;
  nombre: string;
  campeon: string;
  subcampeon: string;
  bloqueado: boolean;
  fecha_creacion: string;
  puntos_pronosticos: number;
  exactos_acertados: number;
  ganadores_acertados: number;
  puntos_campeon: number;
  puntos_subcampeon: number;
  puntos_totales: number;
}
export type StageName = 'Grupo A' | 'Grupo B' | 'Grupo C' | 'Grupo D' | 'Grupo E' | 'Grupo F' | 'Grupo G' | 'Grupo H' | 'Grupo I' | 'Grupo J' | 'Grupo K' | 'Grupo L' | 'Dieciseisavos' | 'Octavos' | 'Cuartos' | 'Semifinal' | 'Tercer puesto' | 'Final';
