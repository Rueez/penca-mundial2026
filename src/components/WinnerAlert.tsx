import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, X, Star } from 'lucide-react';

export const WinnerAlert: React.FC = () => {
  // Al iniciar siempre en true, aparecerá con cada recarga de página
  const [showAlert, setShowAlert] = useState(true);
  const navigate = useNavigate();

  const handleClose = () => {
    setShowAlert(false);
  };

  const handleGoToRanking = () => {
    handleClose();
    navigate('/ranking'); 
  };

  if (!showAlert) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-center overflow-hidden">
        
        {/* Destello de fondo decorativo */}
        <div className="absolute -left-16 -top-16 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -right-16 -bottom-16 w-36 h-36 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Botón de cierre rápido arriba a la derecha */}
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
          title="Cerrar ventana"
        >
          <X className="h-5 w-5" />
        </button>
        
        {/* Ícono de la copa principal */}
        <div className="mx-auto w-16 h-16 bg-amber-400/15 border border-amber-400/25 text-amber-400 rounded-2xl flex items-center justify-center mb-4">
          <Trophy className="h-8 w-8 animate-pulse" />
        </div>

        {/* Título */}
        <h2 className="text-2xl font-black text-slate-100 mb-2 tracking-tight">
          ¡Final de la Penca 2026!
        </h2>
        
        {/* Cuerpo del mensaje */}
        <p className="text-slate-300 text-sm leading-relaxed mb-4 font-medium px-2">
          Hubo un tremendo empate en la cima de la tabla. ¡Felicitaciones a <span className="text-amber-400 font-bold">Mily</span> y <span className="text-amber-400 font-bold">Juan Pablo Fassio</span> por coronarse campeones con 86 puntos! 🤝💰
        </p>

        {/* Mención especial */}
        <div className="bg-slate-950/50 border border-slate-850 rounded-xl p-3 text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1.5 mb-6 mx-1">
          <Star className="h-3.5 w-3.5 fill-current shrink-0" />
          <span>Tito fue el único que embocó a España campeón 🇪🇸🔥</span>
        </div>

        {/* Botón de acción */}
        <button
          onClick={handleGoToRanking}
          className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold rounded-xl transition duration-200 shadow-lg shadow-amber-500/10 text-sm tracking-wide"
        >
          Entrar a ver la Tabla
        </button>
      </div>
    </div>
  );
};

export default WinnerAlert;