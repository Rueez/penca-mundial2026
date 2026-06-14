import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import type { Partido } from '../types/database.types';
import { MatchCard } from '../components/MatchCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { isRegistrationClosed } from '../utils/timezone';
import { User, Trophy, Save, AlertCircle, CheckCircle } from 'lucide-react';

type TabType = 'Grupos A-D' | 'Grupos E-H' | 'Grupos I-L' | 'Dieciseisavos' | 'Octavos' | 'Fase Final';

export const Play: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [matches, setMatches] = useState<Partido[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  
  // Paso y Flujo
  const [step, setStep] = useState(1); // 1: Nombre, 2: Pronósticos y Especiales, 3: Éxito
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  
  // Predicciones
  const [predictions, setPredictions] = useState<Record<number, { goles_local: number; goles_visitante: number }>>({});
  const [champion, setChampion] = useState('');
  const [subchampion, setSubchampion] = useState('');
  
  // UI Tabs
  const [activeTab, setActiveTab] = useState<TabType>('Grupos A-D');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  
  const isClosed = isRegistrationClosed();
// Cargar partidos y equipos
  useEffect(() => {
    if (isClosed) return;

    const loadData = async () => {
      try {
        setLoading(true);
        // 1. Cargar todos los partidos ordenados por FECHA
        const { data: matchesData, error: matchesError } = await supabase
          .from('partidos')
          .select('*')
          .order('fecha', { ascending: true }); // 🛡️ CORREGIDO: De id a fecha

        if (matchesError) throw matchesError;

        if (matchesData) {
          setMatches(matchesData as Partido[]);
          
          // Inicializar predicciones con 0-0 por defecto
          const initialPredictions: Record<number, { goles_local: number; goles_visitante: number }> = {};
          matchesData.forEach(m => {
            initialPredictions[m.id] = { goles_local: 0, goles_visitante: 0 };
          });
          setPredictions(initialPredictions);

          // 2. Extraer los equipos de fase de grupos
          const groupTeams = new Set<string>();
          matchesData.forEach(m => {
            // Se agrega el "m.grupo &&" por seguridad
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
  }, [isClosed]);

  // Paso 1: Validar Nombre
  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setNameError('El nombre no puede estar vacío.');
      return;
    }

    try {
      setNameError('');
      // Consultar si ya existe en la base de datos
      const { data, error } = await supabase
        .from('participantes')
        .select('id')
        .eq('nombre', cleanName)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setNameError('Este nombre ya tiene una penca registrada.');
      } else {
        // Proceder al paso 2
        setStep(2);
      }
    } catch (err) {
      console.error('Error al validar nombre:', err);
      setNameError('Error al validar el nombre. Inténtalo de nuevo.');
    }
  };

  // Guardar marcador de predicción
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

  // Enviar Penca completo
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

      // 1. Guardar el participante en la base de datos (con bloqueado=true)
      const { data: newParticipant, error: participantError } = await supabase
        .from('participantes')
        .insert([
          {
            nombre: name.trim(),
            campeon: champion,
            subcampeon: subchampion,
          }
        ])
        .select()
        .single();

if (participantError) {
  console.error("PARTICIPANT ERROR:", participantError);
  alert(JSON.stringify(participantError));
  throw participantError;
}
      // 2. Preparar el array de predicciones
      const pronosticosData = matches.map(m => ({
        participante_id: newParticipant.id,
        partido_id: m.id,
        goles_local: predictions[m.id]?.goles_local ?? 0,
        goles_visitante: predictions[m.id]?.goles_visitante ?? 0
      }));

      // 3. Insertar todas las predicciones
      const { error: pronosticosError } = await supabase
        .from('pronosticos')
        .insert(pronosticosData);

      if (pronosticosError) {
        // En caso de fallo, intentamos limpiar el participante
        await supabase.from('participantes').delete().eq('id', newParticipant.id);
        throw pronosticosError;
      }

      // 4. Ir a la pantalla de éxito
      setStep(3);
    } catch (err) {
      console.error('Error al guardar la penca:', err);
      alert('Hubo un error al guardar tus pronósticos. Por favor, vuelve a intentarlo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isClosed) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="glass-panel p-8 rounded-3xl border-red-500/20 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-100 mb-4">Inscripciones Cerradas</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Las inscripciones para la Penca Mundial 2026 ya se encuentran cerradas debido a que ha comenzado el primer partido del torneo.
          </p>
          <Link
            to="/"
            className="inline-flex w-full justify-center px-5 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white rounded-xl transition font-bold"
          >
            Volver al Inicio
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  // Paso 1: Ingreso de Nombre
  if (step === 1) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="glass-panel p-8 rounded-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-b from-amber-500/5 to-transparent pointer-events-none" />
          
          <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-6 z-10 relative">
            <User className="h-8 w-8" />
          </div>
          
          <h2 className="text-2xl font-black text-center text-slate-100 mb-2 z-10 relative">Tu Participación</h2>
          <p className="text-slate-400 text-center text-xs leading-relaxed mb-8 z-10 relative">
            Ingresa tu nombre para comenzar a rellenar tus pronósticos. DESPUES DE COMPLETAR Y ENVIAR LA PENCA NO SE PUEDE MODIFICAR
          </p>

          <form onSubmit={handleNameSubmit} className="space-y-6 z-10 relative">
            <div>
              <label htmlFor="nombre" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Nombre de Participante
              </label>
              <input
                id="nombre"
                type="text"
                autoFocus
                placeholder="Ej: Juan Pérez"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError('');
                }}
                className={`w-full px-4 py-3 bg-slate-950/60 border ${
                  nameError ? 'border-red-500' : 'border-slate-700 focus:border-amber-400'
                } rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none transition font-semibold`}
              />
              {nameError && (
                <p className="text-red-500 text-xs font-semibold mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {nameError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition shadow-lg shadow-amber-400/10"
            >
              Continuar a Pronósticos
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Paso 2: Llenar Pronósticos
  if (step === 2) {
    const filteredMatches = getFilteredMatches();
    
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header de bienvenida */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 bg-slate-900/40 p-5 border border-slate-800/80 rounded-2xl">
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Participante</span>
            <h2 className="text-2xl font-black text-slate-100">{name}</h2>
          </div>
          <div className="text-right hidden md:block">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Mundial FIFA 2026</span>
            <div className="text-sm font-semibold text-amber-400">104 Partidos a Pronosticar</div>
          </div>
        </div>

        {/* Pestañas de Navegación por Etapas */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-800/80 pb-4 justify-center md:justify-start">
          {(['Grupos A-D', 'Grupos E-H', 'Grupos I-L', 'Dieciseisavos', 'Octavos', 'Fase Final'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition ${
                activeTab === tab
                  ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-400/5'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

     {/* Lista de Partidos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {filteredMatches.map((match) => {
            // 1. Obtenemos la hora actual de Uruguay (Ej: 16, 20) y los minutos
            const ahora = new Date();
            const horaActual = ahora.getHours();
            const minutosActuales = ahora.getMinutes();

            // 2. Extraemos la hora del partido directamente del texto de Supabase
            // Si "match.fecha" es "2026-06-14 17:00:00", esto saca un 17 y un 0
            const textoFecha = match.fecha || "";
            const partesTiempo = textoFecha.includes(" ") ? textoFecha.split(" ")[1] : textoFecha.split("T")[1];
            
            let horaPartido = 0;
            let minutosPartido = 0;
            
            if (partesTiempo) {
              horaPartido = parseInt(partesTiempo.split(":")[0], 10);
              minutosPartido = parseInt(partesTiempo.split(":")[1], 10);
            }

            // 3. Calculamos el tiempo total en minutos desde que arrancó el día
            const tiempoActualEnMinutos = (horaActual * 60) + minutosActuales;
            const tiempoPartidoEnMinutos = (horaPartido * 60) + minutosPartido;

            // 4. Bloqueamos el partido si ya se pasó de la hora o si ya está finalizado
            // 🚨 NOTA: Si en Supabase pusiste la hora UTC (+3 horas), cambias la línea de abajo por:
            // const yaEmpezo = tiempoActualEnMinutos >= (tiempoPartidoEnMinutos - 180);
            const yaEmpezo = tiempoActualEnMinutos >= tiempoPartidoEnMinutos;
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

        {/* Predicciones Especiales (solo se muestra en la pestaña Fase Final para no estorbar, o al final de la página) */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800/80 mb-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-r from-amber-500/5 to-transparent pointer-events-none" />
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800/60 pb-3">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h3 className="text-lg font-black text-slate-100">Predicciones Especiales</h3>
          </div>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Suma puntos adicionales al final de la copa si aciertas el Campeón (+10 puntos) y el Subcampeón (+5 puntos).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="campeon" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Campeón del Mundial
              </label>
              <select
                id="campeon"
                value={champion}
                onChange={(e) => setChampion(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:border-amber-400 focus:outline-none transition font-semibold"
              >
                <option value="" disabled>Selecciona un país...</option>
                {teams.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="subcampeon" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Subcampeón del Mundial
              </label>
              <select
                id="subcampeon"
                value={subchampion}
                onChange={(e) => setSubchampion(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:border-amber-400 focus:outline-none transition font-semibold"
              >
                <option value="" disabled>Selecciona un país...</option>
                {teams.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Botón de Enviar Penca */}
        <div className="flex justify-end gap-4 border-t border-slate-800/80 pt-6">
          <button
            onClick={() => setStep(1)}
            disabled={submitting}
            className="px-5 py-3 text-sm font-semibold text-slate-400 hover:text-slate-200 transition"
          >
            Volver al Nombre
          </button>
          
          <button
            onClick={() => {
              if (!champion || !subchampion) {
                alert('Por favor selecciona el Campeón y Subcampeón.');
                return;
              }
              if (champion === subchampion) {
                alert('El campeón y subcampeón no pueden ser el mismo equipo.');
                return;
              }
              setIsConfirmOpen(true);
            }}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition shadow-lg shadow-amber-400/15"
          >
            <Save className="h-4 w-4" /> Enviar Penca
          </button>
        </div>

        {/* Ventana de confirmación */}
        <ConfirmDialog
          isOpen={isConfirmOpen}
          onConfirm={submitPenca}
          onCancel={() => setIsConfirmOpen(false)}
          title="Confirmar Penca"
          message="Una vez enviada la penca no podrás modificar tus pronósticos. ¿Deseas continuar?"
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
            ✅ Pronósticos enviados correctamente
          </p>
          
          <p className="text-slate-400 text-sm leading-relaxed mb-8 z-10 relative">
            Tu participación ha quedado registrada de forma segura. Tus pronósticos están bloqueados y no podrán ser modificados. Podrás seguir el ranking en tiempo real y consultar los pronósticos de los demás amigos en los listados públicos.
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
              Ver Pronósticos
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Play;
