import React from 'react';
import { Trophy, Users, Calendar, Target, TrendingUp } from 'lucide-react';

interface StatsDashboardProps {
  leaderName: string;
  totalParticipants: number;
  finishedMatches: number;
  totalMatches: number;
  leaderExacts: number;
  averagePoints: number;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
  leaderName,
  totalParticipants,
  finishedMatches,
  totalMatches,
  leaderExacts,
  averagePoints
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 my-6">
      {/* Líder Actual */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-2 right-2 text-amber-500/20 group-hover:text-amber-500/30 transition-colors">
          <Trophy className="h-12 w-12 -mr-2 -mt-2" />
        </div>
        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Líder Actual</span>
        <div className="mt-2">
          <div className="text-base font-extrabold text-slate-100 truncate">{leaderName || 'Nadie aún'}</div>
          <div className="text-[10px] text-amber-400 font-bold flex items-center gap-1 mt-0.5">
            <Trophy className="h-3 w-3" /> Puntero
          </div>
        </div>
      </div>

      {/* Participantes */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-2 right-2 text-indigo-500/20 group-hover:text-indigo-500/30 transition-colors">
          <Users className="h-12 w-12 -mr-2 -mt-2" />
        </div>
        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Participantes</span>
        <div className="mt-2">
          <div className="text-2xl font-extrabold text-slate-100">{totalParticipants}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Amigos en juego</div>
        </div>
      </div>

      {/* Partidos */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-2 right-2 text-emerald-500/20 group-hover:text-emerald-500/30 transition-colors">
          <Calendar className="h-12 w-12 -mr-2 -mt-2" />
        </div>
        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Partidos</span>
        <div className="mt-2">
          <div className="text-2xl font-extrabold text-slate-100">
            {finishedMatches}<span className="text-slate-500 text-sm font-medium">/{totalMatches}</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Finalizados</div>
        </div>
      </div>

      {/* Exactos del Líder */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-2 right-2 text-amber-500/20 group-hover:text-amber-500/30 transition-colors">
          <Target className="h-12 w-12 -mr-2 -mt-2" />
        </div>
        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Aciertos Puntero</span>
        <div className="mt-2">
          <div className="text-2xl font-extrabold text-slate-100">{leaderExacts}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Exactos (3 pts)</div>
        </div>
      </div>

      {/* Promedio General */}
      <div className="glass-panel p-4 rounded-2xl col-span-2 md:col-span-1 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-2 right-2 text-blue-500/20 group-hover:text-blue-500/30 transition-colors">
          <TrendingUp className="h-12 w-12 -mr-2 -mt-2" />
        </div>
        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Promedio Gral</span>
        <div className="mt-2">
          <div className="text-2xl font-extrabold text-slate-100">{averagePoints.toFixed(1)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Puntos por amigo</div>
        </div>
      </div>
    </div>
  );
};

export default StatsDashboard;
