/**
 * Erreurs applicatives et leur correspondance HTTP.
 *
 * Objectif : ne jamais renvoyer de stack trace au client, et toujours
 * renvoyer une réponse au même format.
 */

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
  };
}

/** Erreur attendue, dont le statut HTTP est connu. */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;

  public constructor(statusCode: number, code: ErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }

  public static notFound(message = 'Ressource introuvable.'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }
}

export function toApiErrorBody(error: ApiError): ApiErrorBody {
  return { error: { code: error.code, message: error.message } };
}