interface FichaAnfitrion {
  id: string;
  nombre: string;
  email: string | null;
  rol: string;
}

/** El anfitrión puede tener varias funciones en el mismo cliente. */
export function resolverAnfitrionCalendly(
  fichas: FichaAnfitrion[], correo: string,
): Pick<FichaAnfitrion, 'id' | 'nombre'> | null {
  const email = correo.trim().toLowerCase();
  if (!email) return null;
  const coincidencias = fichas.filter((f) => f.email?.trim().toLowerCase() === email);
  const closers = coincidencias.filter((f) => f.rol === 'closer');
  const candidatas = closers.length > 0 ? closers : coincidencias;
  if (candidatas.length > 1) {
    throw new Error('Calendly: varias fichas posibles para el anfitrión en este cliente. Revisa los roles de Equipo.');
  }
  const ficha = candidatas[0];
  return ficha ? { id: ficha.id, nombre: ficha.nombre } : null;
}

/** ILIKE trata % y _ como comodines; aquí el correo debe coincidir literalmente. */
export const patronCorreoCalendly = (correo: string): string =>
  correo.trim().replace(/[\\%_]/g, '\\$&');
