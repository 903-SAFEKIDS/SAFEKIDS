let sesion = null;

export function guardarSesion(datos) {
  sesion = datos; // { id, nombre, correo, token }
}

export function obtenerToken() {
  return sesion?.token ?? null;
}

export function obtenerUsuario() {
  return sesion ? { id: sesion.id, nombre: sesion.nombre, correo: sesion.correo } : null;
}

export function cerrarSesion() {
  sesion = null;
}