import React from 'react';
import  type { Partido } from '../types/database.types';
import { formatToUruguayTime } from '../utils/timezone';

interface MatchCardProps {
  match: Partido;
  prediction?: { goles_local: number; goles_visitante: number };
  points?: number;
  isPredictionMode?: boolean;
  onPredictionChange?: (matchId: number, field: 'goles_local' | 'goles_visitante', value: number) => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  prediction,
  points,
  isPredictionMode = false,
  onPredictionChange
}) => {
  const formattedTime = formatToUruguayTime(match.fecha, match.hora);

  const handleInputChange = (field: 'goles_local' | 'goles_visitante', valStr: string) => {
    if (!onPredictionChange) return;
    const value = valStr === '' ? 0 : parseInt(valStr, 10);
    if (isNaN(value) || value < 0) return;
    onPredictionChange(match.id, field, value);
  };

  return (
    <div className={`glass-panel p-4 rounded-2xl transition-all relative ${
      match.estado === 'Finalizado' ? 'border-slate-800 bg-slate-900/20' : 'glass-panel-hover'
    }`}>
      {/* Top Details */}
      <div className="flex justify-between items-center text-xs text-slate-400 mb-3 border-b border-slate-800/40 pb-2">
        <span className="font-semibold px-2.5 py-0.5 bg-slate-800/80 rounded-md text-slate-300">
          {match.grupo}
        </span>
        <span className="font-medium">{formattedTime}</span>
      </div>

      {/* Main Core: Teams & Score */}
      <div className="grid grid-cols-7 items-center gap-2 text-center my-3">
        {/* Home Team */}
        <div className="col-span-2 flex flex-col items-center justify-center">
          <div className="text-sm font-bold text-slate-100 line-clamp-2 leading-tight">
            {match.equipo_local}
          </div>
        </div>

       {/* Home Score / Input */}
        <div className="col-span-1 flex justify-center">
          {isPredictionMode ? (
            <input
              type="number"
              min="0"
              placeholder="0"
              value={prediction?.goles_local ?? ''}
              onChange={(e) => handleInputChange('goles_local', e.target.value)}
              disabled={match.estado === 'Finalizado' || match.estado === 'En juego'}
              className={`w-12 h-10 text-center font-bold text-lg border rounded-xl focus:outline-none transition appearance-none ${
                match.estado === 'Finalizado' || match.estado === 'En juego'
                  ? 'bg-slate-900/80 border-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                  : 'bg-slate-950/60 border-slate-700 text-slate-50 focus:border-amber-400'
              }`}
            />
          ) : (
            <div className={`text-2xl font-extrabold ${match.estado === 'Finalizado' ? 'text-slate-100' : 'text-slate-500'}`}>
              {/* 🛡️ CORREGIDO: Ahora sí muestra los goles locales reales */}
              {match.estado === 'Finalizado' ? match.goles_local_real : '-'}
            </div>
          )}
        </div>

        {/* Separator / State */}
        <div className="col-span-1 flex flex-col items-center justify-center">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            {match.estado === 'Finalizado' ? (
              <span className="text-emerald-400 px-1.5 py-0.5 bg-emerald-500/10 rounded text-[9px] border border-emerald-500/20 font-bold">FIN</span>
            ) : match.estado === 'En juego' ? (
              <span className="text-amber-400 px-1.5 py-0.5 bg-amber-500/10 rounded text-[9px] border border-amber-500/20 font-bold animate-pulse">VIVO</span>
            ) : (
              <span className="text-slate-600 text-[10px] font-bold">VS</span>
            )}
          </div>
        </div>

        {/* Visitor Score / Input */}
        <div className="col-span-1 flex justify-center">
          {isPredictionMode ? (
            <input
              type="number"
              min="0"
              placeholder="0"
              value={prediction?.goles_visitante ?? ''}
              onChange={(e) => handleInputChange('goles_visitante', e.target.value)}
              disabled={match.estado === 'Finalizado' || match.estado === 'En juego'}
              className={`w-12 h-10 text-center font-bold text-lg border rounded-xl focus:outline-none transition appearance-none ${
                match.estado === 'Finalizado' || match.estado === 'En juego'
                  ? 'bg-slate-900/80 border-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                  : 'bg-slate-950/60 border-slate-700 text-slate-50 focus:border-amber-400'
              }`}
            />
          ) : (
            <div className={`text-2xl font-extrabold ${match.estado === 'Finalizado' ? 'text-slate-100' : 'text-slate-500'}`}>
              {/* 🛡️ CORREGIDO: Muestra los goles visitantes reales */}
              {match.estado === 'Finalizado' ? match.goles_visitante_real : '-'}
            </div>
          )}
        </div>
        {/* Visitor Team */}
        <div className="col-span-2 flex flex-col items-center justify-center">
          <div className="text-sm font-bold text-slate-100 line-clamp-2 leading-tight">
            {match.equipo_visitante}
          </div>
        </div>
      </div>

      {/* Extra Info (read mode prediction results) */}
      {!isPredictionMode && prediction && (
        <div className="mt-4 pt-3 border-t border-slate-800/40 flex justify-between items-center text-xs">
          <div className="text-slate-400 font-medium">
            Pronóstico: <span className="text-slate-200 font-bold ml-1">{prediction.goles_local} - {prediction.goles_visitante}</span>
          </div>

          {match.estado === 'Finalizado' && (
            <div>
              {points === 3 && (
                <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-bold rounded-lg text-[10px]">
                  Exacto (+3)
                </span>
              )}
              {points === 1 && (
                <span className="px-2 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/20 font-bold rounded-lg text-[10px]">
                  Ganador (+1)
                </span>
              )}
              {points === 0 && (
                <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg text-[10px]">
                  0 pts
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MatchCard;
