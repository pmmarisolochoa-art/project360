import { useEffect, useRef, useState } from 'react';

/**
 * Cronómetro del paso actual. Arranca en 0 cada vez que cambia `stepKey` —
 * no es un cronómetro global de la reunión, es "cuánto lleva ESTE paso".
 * No bloquea nada al pasarse del tiempo sugerido: solo lo reporta, para que
 * la diapositiva decida cómo avisarlo (alerta visual suave).
 */
export function useMeetingTimer(stepKey: string) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetea el cronómetro al cambiar de paso
    setElapsedSec(0);
    return () => clearInterval(id);
  }, [stepKey]);

  return elapsedSec;
}

export function formatElapsed(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
