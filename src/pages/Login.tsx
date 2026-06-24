import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { ShieldCheck, User, Key, AlertCircle, Loader2 } from 'lucide-react';

interface LoginProps {
  onLoginSuccess?: (id: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [nombreIngresado, setNombreIngresado] = useState('');
  const [claveIngresada, setClaveIngresada] = useState('');
  const [cargando, setCargando] = useState(false);
  const [errorTexto, setErrorTexto] = useState('');

  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorTexto('');

    if (!nombreIngresado.trim() || !claveIngresada.trim()) {
      setErrorTexto('Por favor, completa todos los campos.');
      return;
    }

    setCargando(true);

    try {
      // Buscamos al participante que coincida en nombre y clave
      const { data, error } = await supabase
        .from('participantes')
        .select('id, nombre')
        .eq('nombre', nombreIngresado.trim())
        .eq('clave', claveIngresada.trim())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // ¡Login correcto! Guardamos en el localStorage
        localStorage.setItem('participante_id', data.id);
        localStorage.setItem('participante_nombre', data.nombre);

        if (onLoginSuccess) {
          onLoginSuccess(data.id);
        } else {
          window.location.reload();
        }
      } else {
        setErrorTexto('Nombre o clave incorrectos. Revisá bien.');
      }
    } catch (err) {
      console.error(err);
      setErrorTexto('Hubo un error al intentar conectar con el sistema.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md glass-panel p-8 rounded-3xl shadow-2xl relative overflow-hidden border border-slate-800/80">
        
        {/* Efecto de luz sutil de fondo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Encabezado del Login */}
        <div className="text-center mb-8 relative z-10">
          <div className="w-14 h-14 bg-amber-400/10 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20 shadow-inner">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">Ingresar a la Penca</h2>
          <p className="text-xs text-slate-400 mt-1.5 font-medium">
            Colocá tus datos de acceso para administrar tus pronósticos
          </p>
        </div>

        {/* Manejo de Alertas e Errores integrado en la tarjeta */}
        {errorTexto && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-start gap-2.5 text-xs font-semibold animate-shake">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorTexto}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={manejarLogin} className="space-y-5 relative z-10">
          
          {/* Input Nombre */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Tu Nombre completo
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <User className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={nombreIngresado}
                onChange={(e) => setNombreIngresado(e.target.value)}
                placeholder="Ej: Juan Pérez"
                disabled={cargando}
                className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 focus:border-amber-400 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none transition font-semibold text-sm"
              />
            </div>
          </div>

          {/* Input Clave */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Tu Clave / PIN
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Key className="h-4 w-4" />
              </span>
              <input
                type="password"
                value={claveIngresada}
                onChange={(e) => setClaveIngresada(e.target.value)}
                placeholder="••••"
                disabled={cargando}
                className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 focus:border-amber-400 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none transition font-semibold text-sm tracking-widest"
              />
            </div>
          </div>

          {/* Botón de Enviar */}
          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3.5 font-bold text-sm text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:bg-amber-500/50 disabled:text-slate-900 rounded-xl transition shadow-lg shadow-amber-400/5 flex items-center justify-center gap-2 cursor-pointer"
          >
            {cargando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Validando credenciales...
              </>
            ) : (
              'Entrar a Pronosticar'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}