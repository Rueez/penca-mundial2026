import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import type { Partido, RankingRow, Pronostico, Puntuacion } from '../types/database.types';
import { MatchCard } from '../components/MatchCard';
import { Search, User, Trophy, Star} from 'lucide-react';

type TabType = 'Grupos A-D' | 'Grupos E-H' | 'Grupos I-L' | 'Dieciseisavos' | 'Octavos' | 'Fase Final';

export const Participants: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<RankingRow[]>([]);
  const [matches, setMatches] = useState<Partido[]>([]);
  const [search, setSearch] = useState('');
  
  // Selección de participante
  const [selectedParticipant, setSelectedParticipant] = useState<RankingRow | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [predictions, setPredictions] = useState<Record<number, Pronostico>>({});
  const [points, setPoints] = useState<Record<number, number>>({});
  const [activeTab, setActiveTab] = useState<TabType>('Grupos A-D');

  // Cargar lista de participantes y partidos al inicio
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        // 1. Cargar participantes de la vista de ranking
        const { data: rankingData } = await supabase
          .from('ranking')
          .select('*');
        if (rankingData) {
          setParticipants(rankingData as RankingRow[]);
          // Seleccionar el primero por defecto si existe
          if (rankingData.length > 0) {
            setSelectedParticipant(rankingData[0] as RankingRow);
          }
        }

        // 2. Cargar todos los partidos
        const { data: matchesData } = await supabase
          .from('partidos')
          .select('*')
          .order('id', { ascending: true });
        if (matchesData) {
          setMatches(matchesData as Partido[]);
        }
      } catch (err) {
        console.error('Error al cargar participantes:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Cargar detalles cuando cambia el participante seleccionado
  useEffect(() => {
    if (!selectedParticipant) return;

    const loadParticipantDetails = async () => {
      try {
        setLoadingDetails(true);
        // 1. Cargar pronósticos
        const { data: pronData } = await supabase
          .from('pronosticos')
          .select('*')
          .eq('participante_id', selectedParticipant.participante_id);

        // 2. Cargar puntuaciones por partido
        const { data: puntData } = await supabase
          .from('puntuaciones')
          .select('*')
          .eq('participante_id', selectedParticipant.participante_id);

        // Mapear a Record por partido_id
        const predMap: Record<number, Pronostico> = {};
        if (pronData) {
          pronData.forEach((p: Pronostico) => {
            predMap[p.partido_id] = p;
          });
        }

        const pointsMap: Record<number, number> = {};
        if (puntData) {
          puntData.forEach((p: Puntuacion) => {
            pointsMap[p.partido_id] = p.puntos;
          });
        }

        setPredictions(predMap);
        setPoints(pointsMap);
      } catch (err) {
        console.error('Error al cargar detalles:', err);
      } finally {
        setLoadingDetails(false);
      }
    };

    loadParticipantDetails();
  }, [selectedParticipant]);

  // Filtrar participantes según búsqueda
  const filteredParticipants = participants.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase())
  );

  // Filtrar partidos de la pestaña activa
  const getFilteredMatches = () => {
    return matches.filter(m => {
      const g = m.grupo;
      if (activeTab === 'Grupos A-D') {
        return ['Grupo A', 'Grupo B', 'Grupo C', 'Grupo D'].includes(g);
      }
      if (activeTab === 'Grupos E-H') {
        return ['Grupo E', 'Grupo F', 'Grupo G', 'Grupo H'].includes(g);
      }
      if (activeTab === 'Grupos I-L') {
        return ['Grupo I', 'Grupo J', 'Grupo K', 'Grupo L'].includes(g);
      }
      if (activeTab === 'Dieciseisavos') {
        return g === 'Dieciseisavos';
      }
      if (activeTab === 'Octavos') {
        return g === 'Octavos';
      }
      if (activeTab === 'Fase Final') {
        return ['Cuartos', 'Semifinal', 'Tercer puesto', 'Final'].includes(g);
      }
      return false;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Panel Izquierdo: Buscador y Lista de Participantes */}
        <div className="lg:col-span-4 flex flex-col h-[calc(100vh-12rem)] min-h-[400px]">
          <h2 className="text-xl font-bold tracking-tight text-slate-100 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-amber-400 rounded-full" /> Participantes
          </h2>

          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar amigo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 focus:border-amber-400 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none transition text-sm font-semibold"
            />
          </div>

          <div className="glass-panel rounded-2xl flex-1 overflow-y-auto divide-y divide-slate-850 p-2">
            {filteredParticipants.length > 0 ? (
              filteredParticipants.map((p) => (
                <button
                  key={p.participante_id}
                  onClick={() => setSelectedParticipant(p)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition flex justify-between items-center ${
                    selectedParticipant?.participante_id === p.participante_id
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'text-slate-300 hover:bg-slate-900/40 hover:text-slate-100'
                  }`}
                >
                  <div className="truncate pr-2 flex items-center gap-2">
                    <User className="h-4 w-4 shrink-0" />
                    <span className="truncate">{p.nombre}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-xs font-extrabold ${
                    selectedParticipant?.participante_id === p.participante_id
                      ? 'bg-slate-950/20 text-slate-950 border border-slate-950/10'
                      : 'bg-slate-900 text-amber-400 border border-slate-800'
                  }`}>
                    {p.puntos_totales} pts
                  </span>
                </button>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">
                No hay participantes registrados.
              </div>
            )}
          </div>
        </div>

        {/* Panel Derecho: Estadísticas y Pronósticos del amigo seleccionado */}
        <div className="lg:col-span-8">
          {selectedParticipant ? (
            <div>
              {/* Encabezado Perfil */}
              <div className="glass-panel p-6 rounded-3xl border-slate-800/80 mb-6 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="absolute inset-0 bg-linear-to-r from-amber-500/5 to-transparent pointer-events-none" />
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pronósticos de</span>
                  <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2 mt-0.5">
                    {selectedParticipant.nombre}
                  </h1>
                </div>
                
                {/* Especiales elegidos */}
                <div className="flex flex-col sm:flex-row gap-4 text-xs font-semibold text-slate-300 shrink-0">
                  <div className="px-3.5 py-2 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <div>
                      <div className="text-slate-500 text-[9px] uppercase font-bold">Campeón Elegido</div>
                      <div>{selectedParticipant.campeon}</div>
                    </div>
                  </div>
                  <div className="px-3.5 py-2 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center gap-2">
                    <Star className="h-4 w-4 text-slate-400" />
                    <div>
                      <div className="text-slate-500 text-[9px] uppercase font-bold">Subcampeón Elegido</div>
                      <div>{selectedParticipant.subcampeon}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estadísticas Individuales */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="glass-panel p-4 rounded-2xl text-center">
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Puntos Totales</span>
                  <span className="text-3xl font-black text-amber-400 block mt-1">{selectedParticipant.puntos_totales}</span>
                </div>
                <div className="glass-panel p-4 rounded-2xl text-center">
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Aciertos Exactos</span>
                  <span className="text-3xl font-black text-emerald-400 block mt-1">{selectedParticipant.exactos_acertados}</span>
                </div>
                <div className="glass-panel p-4 rounded-2xl text-center">
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Aciertos Ganador</span>
                  <span className="text-3xl font-black text-blue-400 block mt-1">{selectedParticipant.ganadores_acertados}</span>
                </div>
              </div>

              {/* Pestañas de Etapas */}
              <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-800/80 pb-4 justify-center md:justify-start">
                {(['Grupos A-D', 'Grupos E-H', 'Grupos I-L', 'Dieciseisavos', 'Octavos', 'Fase Final'] as TabType[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
                      activeTab === tab
                        ? 'bg-amber-400 text-slate-950 border-amber-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Detalle de Pronósticos */}
              {loadingDetails ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-400"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {getFilteredMatches().map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      isPredictionMode={false}
                      prediction={predictions[match.id]}
                      points={points[match.id]}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="glass-panel p-16 text-center rounded-3xl text-slate-400 flex flex-col items-center justify-center h-full min-h-[300px]">
              <User className="h-12 w-12 text-slate-600 mb-4" />
              <h3 className="text-lg font-bold text-slate-300">Selecciona un amigo</h3>
              <p className="text-sm text-slate-500 max-w-sm mt-1">
                Haz clic en cualquier participante de la lista izquierda para visualizar su cartilla de pronósticos y estadísticas.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Participants;
