export class AuthorityHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthorityHttpError";
    this.status = status;
  }
}

export function authorityBadRequest(message: string) {
  return new AuthorityHttpError(400, message);
}

export function authorityNotFound(message: string) {
  return new AuthorityHttpError(404, message);
}

export function authorityConflict(message: string) {
  return new AuthorityHttpError(409, message);
}

export function authorityUnsupported(message: string) {
  return new AuthorityHttpError(501, message);
}

export function isAuthorityHttpError(error: unknown): error is AuthorityHttpError {
  return error instanceof AuthorityHttpError;
}

export function getAuthorityHttpErrorStatus(error: unknown) {
  return isAuthorityHttpError(error) ? error.status : 500;
}

export function getAuthorityHttpErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
