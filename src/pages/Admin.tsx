import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import type { Partido, RankingRow } from '../types/database.types';
import { formatToUruguayTime } from '../utils/timezone';
import { Settings, ShieldAlert, KeyRound, Download, Save, RefreshCw, Trophy } from 'lucide-react';
import * as XLSX from 'xlsx';

type AdminTab = 'partidos' | 'participantes' | 'estadisticas';

export const Admin: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  // UI Admin State
  const [activeTab, setActiveTab] = useState<AdminTab>('partidos');
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Partido[]>([]);
  const [participants, setParticipants] = useState<RankingRow[]>([]);
  
  // Filtro de partidos
  const [matchFilter, setMatchFilter] = useState<'Todos' | 'Pendiente' | 'En juego' | 'Finalizado'>('Todos');
  
  // Estado para la edición de partidos
  const [editingScores, setEditingScores] = useState<Record<number, { goles_local: number; goles_visitante: number; ganador?: string }>>({});
  const [updatingMatchId, setUpdatingMatchId] = useState<number | null>(null);

  // Intentar cargar la contraseña de la sesión
  useEffect(() => {
    const savedPassword = sessionStorage.getItem('penca_admin_token');
    const envPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'soloadmin123';
    
    if (savedPassword === envPassword && savedPassword) {
  setIsAuthenticated(true);
  setPassword(savedPassword);
}
  }, []);

  // Cargar datos administrativos
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadAdminData = async () => {
      try {
        setLoading(true);
        // 1. Cargar partidos ordenados por Calendario Real (Fecha y Hora)
const { data: matchesData } = await supabase
  .from('partidos')
  .select('*')
  .order('fecha', { ascending: true }) // <-- Ordena de la fecha más vieja a la más nueva
  .order('hora', { ascending: true }); // <-- Si juegan el mismo día, los ordena por horario

if (matchesData) {
  setMatches(matchesData as Partido[]);
  
  // Inicializar marcadores de edición
  const editMap: Record<number, { goles_local: number; goles_visitante: number; ganador?: string }> = {};
  matchesData.forEach(m => {
    editMap[m.id] = {
      goles_local: m.goles_local_real ?? 0,
      goles_visitante: m.goles_visitante_real ?? 0,
      ganador: m.equipo_ganador || ''
    };
  });
  setEditingScores(editMap);
}

        // 2. Cargar participantes (del ranking en tiempo real)
        const { data: rankingData } = await supabase
          .from('ranking')
          .select('*');
        if (rankingData) {
          setParticipants(rankingData as RankingRow[]);
        }
      } catch (err) {
        console.error('Error al cargar datos administrativos:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAdminData();
  }, [isAuthenticated]);

  // Validar contraseña
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const envPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'soloadmin123';
    if (password === envPassword) {
      setIsAuthenticated(true);
      sessionStorage.setItem('penca_admin_token', password);
      setAuthError('');
    } else {
      setAuthError('Contraseña incorrecta. Inténtalo de nuevo.');
    }
  };

  // Modificar marcador local de edición
  const handleScoreChange = (matchId: number, field: 'goles_local' | 'goles_visitante' | 'ganador', value: any) => {
    setEditingScores(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [field]: value
      }
    }));
  };

  // Finalizar un partido (Calcula puntuaciones en cascada y cruces)
  const handleFinalizeMatch = async (matchId: number) => {
    const editData = editingScores[matchId];
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    // Si es empate y eliminatoria directa, exigir ganador por penales
    const isKnockout = !match.grupo.startsWith('Grupo');
    const isDraw = editData.goles_local === editData.goles_visitante;
    
    if (isKnockout && isDraw && !editData.ganador) {
      alert('Para partidos eliminatorios que terminan en empate, debes seleccionar el equipo ganador de la tanda de penales.');
      return;
    }

    try {
      setUpdatingMatchId(matchId);
      // Invocación a RPC segura en Supabase con contraseña
      const { error } = await supabase.rpc('finalizar_partido_seguro', {
        p_partido_id: matchId,
        p_goles_local: editData.goles_local,
        p_goles_visitante: editData.goles_visitante,
        p_ganador: isDraw && isKnockout ? editData.ganador : '',
        p_password: "soloadmin123"
      });

      if (error) throw error;

      // Recargar datos
      const { data: updatedMatch } = await supabase
        .from('partidos')
        .select('*')
        .eq('id', matchId)
        .single();

      if (updatedMatch) {
        setMatches(prev => prev.map(m => m.id === matchId ? (updatedMatch as Partido) : m));
      }

      // Recargar ranking
      const { data: rankingData } = await supabase.from('ranking').select('*');
      if (rankingData) setParticipants(rankingData as RankingRow[]);

      alert(`Partido ${matchId} finalizado correctamente.`);
    } catch (err: any) {
      console.error('Error al finalizar partido:', err);
      alert(err.message || 'Error al finalizar el partido. Verifica que la contraseña del admin en el .env coincida con la base de datos.');
    } finally {
      setUpdatingMatchId(null);
    }
  };

  // Reabrir un partido (Limpia marcadores y puntuaciones)
  const handleReopenMatch = async (matchId: number) => {
    if (!window.confirm('¿Estás seguro de reabrir este partido? Se borrarán todos los puntos asignados y se revertirá el cruce automático.')) {
      return;
    }

    try {
      setUpdatingMatchId(matchId);
      const { error } = await supabase.rpc('reabrir_partido_seguro', {
        p_partido_id: matchId,
        p_nuevo_estado: 'Pendiente',
        p_password: password
      });

      if (error) throw error;

      // Recargar partidos
      const { data: matchesData } = await supabase
        .from('partidos')
        .select('*')
        .order('id', { ascending: true });
      if (matchesData) {
        setMatches(matchesData as Partido[]);
      }

      // Recargar ranking
      const { data: rankingData } = await supabase.from('ranking').select('*');
      if (rankingData) setParticipants(rankingData as RankingRow[]);

      alert(`Partido ${matchId} reabierto con éxito.`);
    } catch (err: any) {
      console.error('Error al reabrir partido:', err);
      alert(err.message || 'Error al reabrir el partido.');
    } finally {
      setUpdatingMatchId(null);
    }
  };

  // Exportar a Excel usando SheetJS
  const handleExportXLSX = (fileName: string) => {
    const dataToExport = participants.map((row, idx) => ({
      'Posición': idx + 1,
      'Nombre': row.nombre,
      'Puntos Totales': row.puntos_totales,
      'Exactos Acertados': row.exactos_acertados,
      'Ganadores Acertados': row.ganadores_acertados,
      'Puntos Pronósticos': row.puntos_pronosticos,
      'Campeón Elegido': row.campeon,
      'Subcampeón Elegido': row.subcampeon,
      'Fecha Registro': new Date(row.fecha_creacion).toLocaleDateString('es-UY')
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultados');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };

  // Exportar a CSV
  const handleExportCSV = (fileName: string) => {
    const dataToExport = participants.map((row, idx) => ({
      'Posicion': idx + 1,
      'Nombre': row.nombre,
      'Puntos_Totales': row.puntos_totales,
      'Exactos_Acertados': row.exactos_acertados,
      'Ganadores_Acertados': row.ganadores_acertados,
      'Puntos_Pronosticos': row.puntos_pronosticos,
      'Campeon_Elegido': row.campeon,
      'Subcampeon_Elegido': row.subcampeon,
      'Fecha_Registro': new Date(row.fecha_creacion).toLocaleDateString('es-UY')
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtrar partidos
  const filteredMatches = matches.filter(m => {
    if (matchFilter === 'Todos') return true;
    return m.estado === matchFilter;
  });

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="glass-panel p-8 rounded-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-b from-indigo-500/5 to-transparent pointer-events-none" />
          
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10">
            <ShieldAlert className="h-8 w-8" />
          </div>
          
          <h2 className="text-2xl font-black text-center text-slate-100 mb-2 relative z-10">Acceso Restringido</h2>
          <p className="text-slate-400 text-center text-xs leading-relaxed mb-8 relative z-10">
            Debes ingresar la contraseña de administrador para realizar modificaciones y consultar datos.
          </p>

          <form onSubmit={handleLogin} className="space-y-6 relative z-10">
            <div>
              <label htmlFor="pass" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Contraseña Administrativa
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  id="pass"
                  type="password"
                  autoFocus
                  placeholder="Ingrese contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 bg-slate-950/60 border border-slate-700 focus:border-amber-400 rounded-xl text-slate-100 placeholder-slate-650 focus:outline-none transition font-semibold"
                />
              </div>
              {authError && <p className="text-red-500 text-xs font-semibold mt-2">{authError}</p>}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition shadow-lg shadow-amber-400/10"
            >
              Desbloquear Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Encabezado Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-100 flex items-center gap-2">
            <Settings className="h-8 w-8 text-indigo-400" /> Panel de Control Admin
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Gestión segura de partidos, puntuaciones y exportación de planillas.
          </p>
        </div>

        {/* Cerrar Sesión Admin */}
        <button
          onClick={() => {
            sessionStorage.removeItem('penca_admin_token');
            setIsAuthenticated(false);
            setPassword('');
          }}
          className="px-4 py-2 text-xs font-bold bg-slate-900 border border-slate-800 hover:border-slate-750 text-slate-400 hover:text-slate-200 rounded-xl transition"
        >
          Cerrar Sesión Admin
        </button>
      </div>

      {/* Menú de Pestañas */}
      <div className="flex gap-2 mb-8 border-b border-slate-800/80 pb-4">
        {(['partidos', 'participantes', 'estadisticas'] as AdminTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-bold rounded-xl border capitalize transition ${
              activeTab === tab
                ? 'bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-500/15'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab === 'partidos' ? 'Partidos' : tab === 'participantes' ? 'Inscritos' : 'Estadísticas'}
          </button>
        ))}
      </div>

      {/* Pestaña: Partidos */}
      {activeTab === 'partidos' && (
        <div>
          {/* Filtro de partidos */}
          <div className="flex gap-2 mb-6 justify-center sm:justify-start">
            {(['Todos', 'Pendiente', 'En juego', 'Finalizado'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setMatchFilter(filter)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  matchFilter === filter
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-400"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMatches.map((match) => {
                const isKnockout = !match.grupo.startsWith('Grupo');
                const edit = editingScores[match.id] || { goles_local: 0, goles_visitante: 0, ganador: '' };
                const isDraw = edit.goles_local === edit.goles_visitante;

                return (
                  <div
                    key={match.id}
                    className="glass-panel p-5 rounded-2xl border-slate-800/80 grid grid-cols-1 md:grid-cols-12 items-center gap-4"
                  >
                    {/* Detalles */}
                    <div className="md:col-span-3">
                      <div className="text-xs text-slate-500 font-bold uppercase">{match.grupo}</div>
                      <div className="text-slate-200 font-bold mt-1 text-sm">{formatToUruguayTime(match.fecha, match.hora)}</div>
                      <div className="text-[10px] text-indigo-400 font-semibold mt-0.5">Partido #{match.id}</div>
                    </div>

                    {/* Equipos y Marcadores */}
                    <div className="md:col-span-5 grid grid-cols-7 items-center gap-1 text-center">
                      <div className="col-span-2 text-sm font-bold text-slate-300 truncate">{match.equipo_local}</div>
                      
                      <div className="col-span-1 flex justify-center">
                        <input
                          type="number"
                          min="0"
                          disabled={match.estado === 'Finalizado'}
                          value={edit.goles_local}
                          onChange={(e) => handleScoreChange(match.id, 'goles_local', parseInt(e.target.value) || 0)}
                          className="w-10 h-8 text-center font-bold bg-slate-950 border border-slate-850 rounded-lg text-slate-200 disabled:opacity-50"
                        />
                      </div>
                      
                      <div className="col-span-1 text-xs text-slate-600 font-bold uppercase">VS</div>
                      
                      <div className="col-span-1 flex justify-center">
                        <input
                          type="number"
                          min="0"
                          disabled={match.estado === 'Finalizado'}
                          value={edit.goles_visitante}
                          onChange={(e) => handleScoreChange(match.id, 'goles_visitante', parseInt(e.target.value) || 0)}
                          className="w-10 h-8 text-center font-bold bg-slate-950 border border-slate-850 rounded-lg text-slate-200 disabled:opacity-50"
                        />
                      </div>
                      
                      <div className="col-span-2 text-sm font-bold text-slate-300 truncate">{match.equipo_visitante}</div>
                    </div>

                    {/* Desempate por penales (Si aplica) */}
                    <div className="md:col-span-2 flex flex-col justify-center">
                      {isKnockout && isDraw && match.estado !== 'Finalizado' && (
                        <div className="w-full">
                          <label className="block text-[10px] font-bold text-amber-500 uppercase mb-1">
                            Ganador Penales
                          </label>
                          <select
                            value={edit.ganador}
                            onChange={(e) => handleScoreChange(match.id, 'ganador', e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                          >
                            <option value="">Seleccionar...</option>
                            <option value={match.equipo_local}>{match.equipo_local}</option>
                            <option value={match.equipo_visitante}>{match.equipo_visitante}</option>
                          </select>
                        </div>
                      )}
                      
                      {match.estado === 'Finalizado' && match.equipo_ganador && isDraw && (
                        <div className="text-[10px] text-amber-500 font-bold text-center">
                          🏆 Ganó Penales: {match.equipo_ganador}
                        </div>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="md:col-span-2 flex justify-end gap-2">
                      {match.estado !== 'Finalizado' ? (
                        <button
                          onClick={() => handleFinalizeMatch(match.id)}
                          disabled={updatingMatchId === match.id}
                          className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5"
                        >
                          <Save className="h-3.5 w-3.5" /> Finalizar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReopenMatch(match.id)}
                          disabled={updatingMatchId === match.id}
                          className="w-full py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-red-400 font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Reabrir
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pestaña: Inscritos */}
      {activeTab === 'participantes' && (
        <div className="glass-panel rounded-3xl border-slate-800/80 shadow-2xl p-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 border-b border-slate-850 pb-4">
            <h3 className="text-lg font-black text-slate-100">Amigos Inscritos ({participants.length})</h3>
            
            {/* Exportar */}
            <div className="flex gap-2">
              <button
                onClick={() => handleExportCSV('ranking_penca')}
                className="px-3.5 py-2 text-xs bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" /> Exportar CSV
              </button>
              <button
                onClick={() => handleExportXLSX('ranking_penca')}
                className="px-3.5 py-2 text-xs bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-indigo-500/10"
              >
                <Download className="h-3.5 w-3.5" /> Exportar XLSX
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-450 text-xs font-bold uppercase border-b border-slate-850 pb-3">
                  <th className="py-3 px-4">Nombre</th>
                  <th className="py-3 px-4 text-center">Puntos</th>
                  <th className="py-3 px-4">Campeón Elegido</th>
                  <th className="py-3 px-4">Subcampeón Elegido</th>
                  <th className="py-3 px-4">Fecha Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {participants.map((p) => (
                  <tr key={p.participante_id} className="text-slate-300 text-sm hover:bg-slate-900/10">
                    <td className="py-3.5 px-4 font-bold text-slate-100">{p.nombre}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-extrabold text-amber-400">{p.puntos_totales} pts</span>
                    </td>
                    <td className="py-3.5 px-4">{p.campeon}</td>
                    <td className="py-3.5 px-4">{p.subcampeon}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {new Date(p.fecha_creacion).toLocaleString('es-UY', { timeZone: 'America/Montevideo' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pestaña: Estadísticas */}
      {activeTab === 'estadisticas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel p-6 rounded-3xl border-slate-800/80 shadow-2xl">
            <h3 className="text-lg font-black text-slate-100 border-b border-slate-850 pb-3 mb-4">Métricas del Torneo</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-850/60">
                <span className="text-slate-400 font-medium">Participantes registrados:</span>
                <span className="font-bold text-slate-200">{participants.length}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-850/60">
                <span className="text-slate-400 font-medium">Partidos jugados (finalizados):</span>
                <span className="font-bold text-emerald-400">
                  {matches.filter(m => m.estado === 'Finalizado').length}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-850/60">
                <span className="text-slate-400 font-medium">Partidos pendientes:</span>
                <span className="font-bold text-amber-500">
                  {matches.filter(m => m.estado !== 'Finalizado').length}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-medium">Promedio de puntos por cartón:</span>
                <span className="font-bold text-indigo-400">
                  {participants.length > 0
                    ? (participants.reduce((sum, p) => sum + p.puntos_totales, 0) / participants.length).toFixed(2)
                    : '0.00'}
                </span>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-3xl border-slate-800/80 shadow-2xl flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-100 border-b border-slate-850 pb-3 mb-4">Líder Puntero</h3>
              {participants.length > 0 ? (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-400/10 text-amber-400 border border-amber-400/20 rounded-full flex items-center justify-center">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-lg font-black text-slate-100">{participants[0].nombre}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Puntos totales: <span className="text-amber-400 font-bold">{participants[0].puntos_totales}</span> |
                      Exactos: <span className="text-slate-200 font-bold">{participants[0].exactos_acertados}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">No hay participantes registrados todavía.</div>
              )}
            </div>
            
            {participants.length > 0 && (
              <div className="mt-6 p-4 bg-slate-950/60 border border-slate-850 rounded-2xl text-xs text-slate-400 leading-relaxed">
                📌 El líder acertó <span className="font-bold text-slate-200">{participants[0].exactos_acertados}</span> resultados exactos de los partidos y un total de <span className="font-bold text-slate-200">{participants[0].ganadores_acertados}</span> ganadores o empates.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
