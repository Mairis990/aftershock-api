// Nombres EXACTOS de estados (los mismos que usa la app).
export const ESTADOS = ['Pendiente', 'En revisión', 'En proceso', 'Atendida', 'Rechazada', 'Cancelada'];

// Transiciones que puede hacer el ADMINISTRADOR. "Cancelada" solo la hace la persona afectada.
export const TRANSICIONES = {
  'Pendiente': ['En revisión', 'Rechazada'],
  'En revisión': ['En proceso', 'Rechazada'],
  'En proceso': ['Atendida', 'Rechazada'],
  'Atendida': [],
  'Rechazada': [],
  'Cancelada': [],
};
