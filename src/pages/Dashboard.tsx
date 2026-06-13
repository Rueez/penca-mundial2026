import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import type { Partido } from '../types/database.types';
import { StatsDashboard } from '../components/StatsDashboard';
import { MatchCard } from '../components/MatchCard';
import { isRegistrationClosed } from '../utils/timezone';
import { Trophy, ArrowRight, Play, AlertCircle } from 'lucide-react';


  export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [upcomingMatches, setUpcomingMatches] = useState<Partido[]>([]);
  const [stats] = useState({
    leaderName: '',
    totalParticipants: 0,
    finishedMatches: 0,
    totalMatches: 104,
    leaderExacts: 0,
    averagePoints: 0
  });

  const isClosed = isRegistrationClosed();

useEffect(() => {
  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const { data: matchesData, error } = await supabase
        .from('partidos')
        .select('*');

      console.log("MATCHES RAW:", matchesData);

      if (error) {
        console.error("Supabase error:", error);
        return;
      }

 if (matchesData) {
  const filtered = (matchesData as Partido[]).filter((m) => {
    const esGrupo = m.grupo?.startsWith("Grupo");

    const noFinalizado = m.estado !== "Finalizado";

    const noPlaceholder =
      !m.equipo_local?.includes("Ganador") &&
      !m.equipo_local?.includes("Perdedor") &&
      !m.equipo_visitante?.includes("Ganador") &&
      !m.equipo_visitante?.includes("Perdedor");

    return esGrupo && noFinalizado && noPlaceholder;
  });

  setUpcomingMatches(filtered);
}

    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  };

  fetchDashboardData();
}, []);



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Banner de Bienvenida / Hero */}
      <div className="relative rounded-3xl overflow-hidden mb-10 p-8 md:p-12 bg-radial from-slate-900/60 to-slate-950 border border-slate-800/80 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="absolute inset-0 bg-linear-to-r from-amber-500/10 to-indigo-500/10 pointer-events-none" />
        
        <div className="max-w-xl text-center md:text-left z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <Trophy className="h-4 w-4" /> Torneo Privado Mundial 2026
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
            Penca Mundial <span className="text-amber-400">2026</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed mb-6">
Una penca para los muchachos del laburo. 
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center md:justify-start gap-4">
            {!isClosed ? (
              <Link
                to="/jugar"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition shadow-lg shadow-amber-400/20"
              >
                <Play className="h-5 w-5 fill-current" /> Registrar mi Penca
              </Link>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-semibold">
                <AlertCircle className="h-5 w-5 shrink-0" />
                Las inscripciones para la Penca Mundial 2026 ya se encuentran cerradas.
              </div>
            )}
            <Link
              to="/ranking"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 font-bold text-slate-200 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition"
            >
              Ver Ranking <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
        
        {/* Gráfico / Ilustración visual premium */}
        <div className="w-48 h-48 md:w-64 md:h-64 flex items-center justify-center bg-radial from-amber-500/20 to-transparent rounded-full z-10 shrink-0 relative animate-pulse-gold">
          <Trophy className="h-24 w-24 md:h-32 md:w-32 text-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]" />
        </div>
      </div>

      {/* Indicadores en tiempo real */}
      <h2 className="text-xl font-bold tracking-tight text-slate-100 mb-4 flex items-center gap-2">
        <span className="w-1.5 h-6 bg-amber-400 rounded-full" /> Estadísticas Generales
      </h2>
      <StatsDashboard
        leaderName={stats.leaderName}
        totalParticipants={stats.totalParticipants}
        finishedMatches={stats.finishedMatches}
        totalMatches={stats.totalMatches}
        leaderExacts={stats.leaderExacts}
        averagePoints={stats.averagePoints}
      />

      {/* Próximos Partidos */}
      <div className="mt-12">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-indigo-500 rounded-full" /> Próximos Partidos
          </h2>
         {stats.finishedMatches > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-400">
              El torneo ya está en marcha
            </span>
          )}
        </div>

        {upcomingMatches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        ) : (
          <div className="glass-panel p-8 text-center rounded-2xl text-slate-400">
            No hay próximos partidos pendientes de jugar. ¡Todos los partidos han finalizado!
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
