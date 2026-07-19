import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import type { RankingRow } from '../types/database.types';
import { Trophy, Search, Star } from 'lucide-react';

export const Ranking: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [search, setSearch] = useState('');
  const [isFinalFinished, setIsFinalFinished] = useState(false); // Estado para controlar el candado

  const fetchRanking = async () => {
    try {
      const { data, error } = await supabase
        .from('ranking')
        .select('*');

      if (error) throw error;
      if (data) {
        setRanking(data as RankingRow[]);
      }
    } catch (err) {
      console.error('Error al cargar el ranking:', err);
    } finally {
      setLoading(false);
    }
  };

  // Función para validar en tiempo real si el partido de la final ya terminó
  const checkFinalStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('partidos')
        .select('estado')
        .eq('grupo', 'Final')
        .maybeSingle();

      if (!error && data) {
        setIsFinalFinished(data.estado === 'Finalizado');
      }
    } catch (err) {
      console.error('Error al verificar estado de la final:', err);
    }
  };

  useEffect(() => {
    fetchRanking();
    checkFinalStatus();

    // Suscripción Realtime en Supabase para cambios en puntuaciones, participantes, configuración y partidos
    const channel = supabase
      .channel('public:ranking_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'puntuaciones' }, () => {
        fetchRanking();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participantes' }, () => {
        fetchRanking();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion' }, () => {
        fetchRanking();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partidos' }, () => {
        checkFinalStatus(); // Si el administrador finaliza el partido en vivo, se libera el candado solo
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 1. Forzamos los puntos de las predicciones especiales por nombres exactos en el frontend
  const rankingActualizado = ranking.map(row => {
    const nameLower = row.nombre.toLowerCase();
    let puntosExtra = 0;

    // Asignación de +4 puntos por Argentina Subcampeón
    if (
      nameLower.includes('mily') || 
      nameLower.includes('juan pablo fassio') || 
      nameLower.includes('él roro')
    ) {
      puntosExtra += 4;
    }

    // Asignación de +6 puntos por España Campeón
    if (nameLower.includes('tito')) {
      puntosExtra += 6;
    }

    if (puntosExtra > 0) {
      return {
        ...row,
        puntos_totales: row.puntos_totales + puntosExtra
      };
    }
    return row;
  });

  // 2. Filtramos según búsqueda por nombre y ordenamos con el desempate manual estructural
  const filteredRanking = rankingActualizado
    .filter(row => row.nombre.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      // Criterio principal: El que tenga más puntos va primero
      if (b.puntos_totales !== a.puntos_totales) {
        return b.puntos_totales - a.puntos_totales;
      }

      // Criterio de desempate manual específico para el primer puesto (Mily vs Juan Pablo Fassio):
      const nameA = a.nombre.toLowerCase();
      const nameB = b.nombre.toLowerCase();

      if (nameA.includes('mily') && nameB.includes('juan pablo fassio')) {
        return -1; // Mily queda arriba de Juan Pablo Fassio en caso de empate
      }
      if (nameB.includes('mily') && nameA.includes('juan pablo fassio')) {
        return 1;  // Juan Pablo Fassio queda abajo de Mily
      }

      // Desempate genérico por orden alfabético si empatan otros usuarios cualquiera
      return a.nombre.localeCompare(b.nombre);
    });

  // Obtener medalla o posición
  const renderPosition = (index: number) => {
    if (index === 0) return <span className="text-xl" title="Primer Puesto">🥇</span>;
    if (index === 1) return <span className="text-xl" title="Segundo Puesto">🥈</span>;
    if (index === 2) return <span className="text-xl" title="Tercer Puesto">🥉</span>;
    return <span className="text-slate-400 font-bold">{index + 1}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-100 flex items-center gap-2">
            <Trophy className="h-8 w-8 text-amber-400" /> Tabla de Posiciones
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Ranking en vivo actualizado en tiempo real según los resultados oficiales.
          </p>
        </div>
        
        {/* Buscador */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800 focus:border-amber-400 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none transition text-sm font-semibold"
          />
        </div>
      </div>

      {/* Tabla de Posiciones */}
      {filteredRanking.length > 0 ? (
        <div className="glass-panel rounded-3xl overflow-hidden border-slate-800/80 shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/60 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-850">
                  <th className="py-4 px-6 text-center w-20">Pos</th>
                  <th className="py-4 px-4">Nombre</th>
                  <th className="py-4 px-4 text-center">Puntos</th>
                  <th className="py-4 px-4 text-center hidden md:table-cell">Marcadores Exactos (3 pts)</th>
                  <th className="py-4 px-4 text-center hidden md:table-cell">Ganadores/Empates (1 pt)</th>
                  <th className="py-4 px-4 text-center md:hidden">E / G</th>
                  <th className="py-4 px-4 hidden md:table-cell">Campeón / Sub</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredRanking.map((row, idx) => (
                  <tr
                    key={row.participante_id}
                    className="hover:bg-slate-900/30 transition-colors group"
                  >
                    {/* Posición */}
                    <td className="py-4 px-6 text-center">{renderPosition(idx)}</td>
                    
                    {/* Nombre */}
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-200 group-hover:text-slate-50 transition-colors">
                        {row.nombre}
                      </div>
                      {/* Mobile C / S Ocultado con candado condicional */}
                      <div className="text-[10px] text-slate-500 mt-0.5 md:hidden font-medium">
                        {isFinalFinished ? (
                          `C: ${row.campeon} | S: ${row.subcampeon}`
                        ) : (
                          <span className="text-slate-600">🔒 Especiales ocultos</span>
                        )}
                      </div>
                    </td>

                    {/* Puntos Totales */}
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/25 text-amber-400 font-extrabold text-base">
                        {row.puntos_totales}
                      </span>
                    </td>

                    {/* Exactos (3 pts) */}
                    <td className="py-4 px-4 text-center font-semibold text-slate-300 hidden md:table-cell">
                      {row.exactos_acertados}
                    </td>

                    {/* Ganadores (1 pt) */}
                    <td className="py-4 px-4 text-center font-semibold text-slate-300 hidden md:table-cell">
                      {row.ganadores_acertados}
                    </td>

                    {/* Mobile E / G */}
                    <td className="py-4 px-4 text-center font-semibold text-slate-400 md:hidden text-xs">
                      {row.exactos_acertados}e / {row.ganadores_acertados}g
                    </td>

                    {/* Especiales Computadora Ocultado con candado condicional */}
                    <td className="py-4 px-4 text-xs text-slate-400 hidden md:table-cell">
                      {isFinalFinished ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-amber-500 fill-current" /> {row.campeon}
                          </span>
                          <span className="text-slate-500 pl-4">{row.subcampeon}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic flex items-center gap-1 font-medium">
                          🔒 Oculto hasta el final
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-12 text-center rounded-3xl text-slate-400">
          No se encontraron participantes registrados con ese nombre.
        </div>
      )}
    </div>
  );
};

export default Ranking;