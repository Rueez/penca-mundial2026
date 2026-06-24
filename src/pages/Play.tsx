import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import type { Partido } from '../types/database.types';
import { MatchCard } from '../components/MatchCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { isRegistrationClosed } from '../utils/timezone';
import { Trophy, Save, CheckCircle } from 'lucide-react';
import Login from './Login';

type TabType = 'Grupos A-D' | 'Grupos E-H' | 'Grupos I-L' | '16avos' | 'Octavos' | 'Fase Final';

export const Play: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [matches, setMatches] = useState<Partido[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  
  // Extraemos los datos guardados en el login
  const idGuardado = localStorage.getItem('participante_id');
  const nombreGuardado = localStorage.getItem('participante_nombre') || '';

  // Si ya está logueado, arrancamos directo en los partidos (Paso 2)
  const [step, setStep] = useState(idGuardado ? 2 : 1);
  const [name] = useState(nombreGuardado);
  
  // Predicciones
  const [predictions, setPredictions] = useState<Record<number, { goles_local: number; goles_visitante: number }>>({});
  const [champion, setChampion] = useState('');
  const [subchampion, setSubchampion] = useState('');
  
  // UI Tabs
  const [activeTab, setActiveTab] = useState<TabType>('Grupos A-D');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  
  const isClosed = isRegistrationClosed();

  // FILTRO DE SEGURIDAD: Si no hay ID en la sesión, frena acá y pide clave
  if (!idGuardado) {
    return <Login onLoginSuccess={() => window.location.reload()} />;
  }

  // Cargar partidos, equipos y pronósticos existentes
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // 1. Cargar todos los partidos ordenados por FECHA
        const { data: matchesData, error: matchesError } = await supabase
          .from('partidos')
          .select('*')
          .order('fecha', { ascending: true });

        if (matchesError) throw matchesError;

        if (matchesData) {
          setMatches(matchesData as Partido[]);
          
          // Inicializar predicciones base en 0-0
          const initialPredictions: Record<number, { goles_local: number; goles_visitante: number }> = {};
          matchesData.forEach(m => {
            initialPredictions[m.id] = { goles_local: 0, goles_visitante: 0 };
          });

          // Traer los pronósticos que este usuario YA GUARDÓ anteriormente
          const { data: existingPredictions, error: predError } = await supabase
            .from('pronosticos')
            .select('*')
            .eq('participante_id', idGuardado);

          if (!predError && existingPredictions) {
            existingPredictions.forEach(p => {
              if (initialPredictions[p.partido_id]) {
                initialPredictions[p.partido_id] = {
                  goles_local: p.goles_local,
                  goles_visitante: p.goles_visitante
                };
              }
            });
          }

          setPredictions(initialPredictions);

          // Traer las selecciones de Campeón/Subcampeón que ya guardó
          const { data: partData } = await supabase
            .from('participantes')
            .select('campeon, subcampeon')
            .eq('id', idGuardado)
            .maybeSingle();

          if (partData) {
            setChampion(partData.campeon || '');
            setSubchampion(partData.subcampeon || '');
          }

          // 2. Extraer los equipos de fase de grupos
          const groupTeams = new Set<string>();
          matchesData.forEach(m => {
            if (m.grupo && m.grupo.startsWith('Grupo')) {
              groupTeams.add(m.equipo_local);
              groupTeams.add(m.equipo_visitante);
            }
          });
          setTeams(Array.from(groupTeams).sort());
        }
      } catch (err) {
        console.error('Error al cargar datos del torneo:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isClosed, idGuardado]);

  // Guardar marcador de predicción en el estado local
  const handlePredictionChange = (matchId: number, field: 'goles_local' | 'goles_visitante', value: number) => {
    setPredictions(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [field]: value
      }
    }));
  };

  // Filtrar partidos según la pestaña activa
  const getFilteredMatches = () => {
    return matches.filter(m => {
      const g = m.grupo;
      if (activeTab === 'Grupos A-D') return ['Grupo A', 'Grupo B', 'Grupo C', 'Grupo D'].includes(g);
      if (activeTab === 'Grupos E-H') return ['Grupo E', 'Grupo F', 'Grupo G', 'Grupo H'].includes(g);
      if (activeTab === 'Grupos I-L') return ['Grupo I', 'Grupo J', 'Grupo K', 'Grupo L'].includes(g);
      if (activeTab === '16avos') return g === '16avos';
      if (activeTab === 'Octavos') return g === 'Octavos';
      if (activeTab === 'Fase Final') return ['Cuartos', 'Semifinal', 'Tercer puesto', 'Final'].includes(g);
      return false;
    });
  };

  // Enviar Penca completo (Modificación mediante UPSERT)
  const submitPenca = async () => {
    setIsConfirmOpen(false);
    
    if (!champion || !subchampion) {
      alert('Por favor selecciona el Campeón y Subcampeón.');
      return;
    }

    if (champion === subchampion) {
      alert('El campeón y subcampeón no pueden ser el mismo equipo.');
      return;
    }

    try {
      setSubmitting(true);

      // 1. Actualizar campeón y subcampeón en vez de insertar uno nuevo
      const { error: participantError } = await supabase
        .from('participantes')
        .update({
          campeon: champion,
          subcampeon: subchampion,
        })
        .eq('id', idGuardado);

      if (participantError) throw participantError;

      // 2. Preparar el array de predicciones
      const pronosticosData = matches.map(m => ({
        participante_id: idGuardado,
        party_id: m.id, // O partido_id según tu schema, manteniendo tu mapeo
        partido_id: m.id,
        goles_local: predictions[m.id]?.goles_local ?? 0,
        goles_visitante: predictions[m.id]?.goles_visitante ?? 0
      }));

      // 3. Usamos .upsert() para que modifique los goles viejos y no tire duplicados
      const { error: pronosticosError } = await supabase
        .from('pronosticos')
        .upsert(pronosticosData, { onConflict: 'participante_id,partido_id' });

      if (pronosticosError) throw pronosticosError;

      // 4. Ir a la pantalla de éxito
      setStep(3);
    } catch (err) {
      console.error('Error al guardar la penca:', err);
      alert('Hubo un error al guardar tus pronósticos. Por favor, vuelve a intentarlo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  // Paso 1: Ingreso de Nombre (Ocultado por el login, pero conservado)
  if (step === 1) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="glass-panel p-8 rounded-3xl shadow-2xl relative overflow-hidden">
          <h2 className="text-2xl font-black text-center text-slate-100 mb-6">Tu Participación</h2>
          <button onClick={() => setStep(2)} className="w-full py-3.5 font-bold text-slate-950 bg-amber-400 rounded-xl">
            Ir a mis partidos
          </button>
        </div>
      </div>
    );
  }

  // Paso 2: Llenar/Modificar Pronósticos
  if (step === 2) {
    const filteredMatches = getFilteredMatches();
    
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header de bienvenida */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 bg-slate-900/40 p-5 border border-slate-800/80 rounded-2xl">
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Participante Logueado</span>
            <h2 className="text-2xl font-black text-slate-100">{name}</h2>
          </div>
          <div className="text-right hidden md:block">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Penca Activa</span>
            <div className="text-sm font-semibold text-amber-400">Modificá tus resultados</div>
          </div>
        </div>

        {/* Pestañas de Navegación por Etapas */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-800/80 pb-4 justify-center md:justify-start">
          {(['Grupos A-D', 'Grupos E-H', 'Grupos I-L', '16avos', 'Octavos', 'Fase Final'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition ${
                activeTab === tab
                  ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Lista de Partidos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {filteredMatches.map((match) => {
            const ahora = new Date();
            let yaEmpezo = false;
            
            if (match.fecha && match.hora) {
              const stringFechaHora = `${match.fecha}T${match.hora}-03:00`;
              const fechaPartido = new Date(stringFechaHora);
              yaEmpezo = ahora >= fechaPartido;
            }

            const habilitadoParaJugar = !yaEmpezo && match.estado !== 'Finalizado';

            return (
              <MatchCard
                key={match.id}
                match={match}
                isPredictionMode={habilitadoParaJugar} 
                prediction={predictions[match.id]}
                onPredictionChange={handlePredictionChange}
              />
            );
          })}
        </div>

        {/* Predicciones Especiales */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800/80 mb-8 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800/60 pb-3">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h3 className="text-lg font-black text-slate-100">Predicciones Especiales</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="campeon" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Campeon del Mundial
              </label>
              <select
                id="campeon"
                value={champion}
                onChange={(e) => setChampion(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none transition font-semibold"
              >
                <option value="" disabled>Selecciona un pais...</option>
                {teams.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="subcampeon" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Subcampeon del Mundial
              </label>
              <select
                id="subcampeon"
                value={subchampion}
                onChange={(e) => setSubchampion(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none transition font-semibold"
              >
                <option value="" disabled>Selecciona un pais...</option>
                {teams.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Boton de Enviar Penca */}
        <div className="flex justify-end gap-4 border-t border-slate-800/80 pt-6">
          <button
            onClick={() => {
              if (!champion || !subchampion) {
                alert('Por favor selecciona el Campeon y Subcampeon.');
                return;
              }
              if (champion === subchampion) {
                alert('El campeon y subcampeon no pueden ser el mismo equipo.');
                return;
              }
              setIsConfirmOpen(true);
            }}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition shadow-lg"
          >
            <Save className="h-4 w-4" /> Guardar Cambios
          </button>
        </div>

        <ConfirmDialog
          isOpen={isConfirmOpen}
          onConfirm={submitPenca}
          onCancel={() => setIsConfirmOpen(false)}
          title="Confirmar Modificacion"
          message="¿Estas seguro de que queres actualizar tus pronosticos?"
        />
      </div>
    );
  }

  // Paso 3: Pantalla de Éxito
  if (step === 3) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="glass-panel p-8 rounded-3xl border-emerald-500/20 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-b from-emerald-500/5 to-transparent pointer-events-none" />
          
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 z-10 relative">
            <CheckCircle className="h-8 w-8" />
          </div>
          
          <h2 className="text-2xl font-black text-slate-100 mb-2 z-10 relative">Penca Guardada</h2>
          <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6 z-10 relative">
            ✅ Pronosticos enviados correctamente
          </p>
          
          <p className="text-slate-400 text-sm leading-relaxed mb-8 z-10 relative">
            Tus cambios han quedado guardados de forma segura en el sistema. Podras modificarlos de nuevo las veces que quieras antes de que empiece cada partido. ¡Mucho exito!
          </p>

          <div className="space-y-3 z-10 relative">
            <button
              onClick={() => navigate('/ranking')}
              className="inline-flex w-full justify-center py-3 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition shadow-md shadow-amber-400/10"
            >
              Ver Ranking
            </button>
            <button
              onClick={() => navigate('/participantes')}
              className="inline-flex w-full justify-center py-3 text-sm font-bold text-slate-200 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition"
            >
              Ver Pronosticos
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Play;