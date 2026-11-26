export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const noEncontrado = (m = 'No encontrado') => new HttpError(404, m);
