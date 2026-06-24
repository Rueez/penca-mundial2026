/**
 * Convierte una fecha (YYYY-MM-DD) y hora (HH:MM o HH:MM:SS) en hora de Uruguay a un string formateado.
 * Retorna un string formateado para visualización, ej: "Jue 11 Jun, 16:00"
 */
export const formatToUruguayTime = (fechaStr: string, horaStr: string): string => {
  if (!fechaStr || !horaStr) return 'A confirmar';

  // Nos aseguramos de limpiar la hora por si ya trae segundos desde Supabase
  const horaLimpia = horaStr.split(':').slice(0, 2).join(':'); // Deja siempre HH:MM
  
  // Forzamos que lo interprete bajo el huso de Uruguay (-03:00)
  const date = new Date(`${fechaStr.trim()}T${horaLimpia}:00-03:00`);

  if (isNaN(date.getTime())) return 'Invalid Date';
  
  // Formatear en español de Uruguay
  const formatted = date.toLocaleString('es-UY', {
    timeZone: 'America/Montevideo',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  // Capitalizar la primera letra del día
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

/**
 * Retorna solo la hora de Uruguay, ej: "16:00"
 */
export const getUruguayHora = (fechaStr: string, horaStr: string): string => {
  if (!fechaStr || !horaStr) return '--:--';
  const horaLimpia = horaStr.split(':').slice(0, 2).join(':');
  const date = new Date(`${fechaStr.trim()}T${horaLimpia}:00-03:00`);
  
  return date.toLocaleTimeString('es-UY', {
    timeZone: 'America/Montevideo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

/**
 * Retorna solo la fecha de Uruguay, ej: "11/06/2026"
 */
export const getUruguayFecha = (fechaStr: string, horaStr: string): string => {
  if (!fechaStr || !horaStr) return '--/--/----';
  const horaLimpia = horaStr.split(':').slice(0, 2).join(':');
  const date = new Date(`${fechaStr.trim()}T${horaLimpia}:00-03:00`);
  
  return date.toLocaleDateString('es-UY', {
    timeZone: 'America/Montevideo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Obtiene la fecha y hora actual en la base de datos (local time del navegador).
 */
export const getNow = (): Date => {
  return new Date();
};

/**
 * Verifica si las inscripciones ya están cerradas basándose en la fecha/hora del primer partido (en UTC).
 * El primer partido (Partido 1) empieza el 2026-06-11 a las 19:00 UTC.
 */
const REGISTRATION_DEADLINE = new Date('2026-12-31T23:59:59Z');

export const isRegistrationClosed = (): boolean => {
  return getNow() >= REGISTRATION_DEADLINE;
};