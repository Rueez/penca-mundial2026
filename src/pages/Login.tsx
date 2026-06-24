import React, { useState } from 'react';
import { supabase } from '../services/supabase'; // Asegurate de que la ruta a tu cliente de Supabase sea correcta

interface LoginProps {
  onLoginSuccess?: (id: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [nombreIngresado, setNombreIngresado] = useState('');
  const [claveIngresada, setClaveIngresada] = useState('');
  const [cargando, setCargando] = useState(false);

  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombreIngresado || !claveIngresada) {
      alert('Por favor, completa todos los campos.');
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
        .maybeSingle(); // maybeSingle evita errores si no encuentra nada

      if (error) throw error;

      if (data) {
        // ¡Login correcto! Guardamos el ID en el localStorage del navegador
        localStorage.setItem('participante_id', data.id);
        localStorage.setItem('participante_nombre', data.nombre);

        alert(`¡Bienvenido de nuevo, ${data.nombre}!`);

        // Si usás una función para redireccionar o avisar al App.tsx
        if (onLoginSuccess) {
          onLoginSuccess(data.id);
        } else {
          // Si no tenés router, un f5 recarga la app sabiendo que ya está logueado
          window.location.reload();
        }
      } else {
        alert('Nombre o clave incorrectos. Revisá bien.');
      }
    } catch (err) {
      console.error(err);
      alert('Hubo un error al intentar ingresar.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto' }}>
      <h2>Ingresar a la Penca</h2>
      <form onSubmit={manejarLogin}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Tu Nombre:</label>
          <input
            type="text"
            value={nombreIngresado}
            onChange={(e) => setNombreIngresado(e.target.value)}
            placeholder="Ej: Juan Pérez"
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Tu Clave / PIN:</label>
          <input
            type="password"
            value={claveIngresada}
            onChange={(e) => setClaveIngresada(e.target.value)}
            placeholder="****"
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <button type="submit" disabled={cargando} style={{ width: '100%', padding: '10px', cursor: 'pointer' }}>
          {cargando ? 'Ingresando...' : 'Entrar a Pronosticar'}
        </button>
      </form>
    </div>
  );
}