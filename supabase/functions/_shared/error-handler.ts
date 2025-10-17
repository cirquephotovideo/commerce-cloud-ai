import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export enum ErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR'
}

interface SafeError {
  code: ErrorCode;
  message: string;
  statusCode: number;
}

export const handleError = (
  error: unknown, 
  context: string,
  corsHeaders: Record<string, string>
): Response => {
  // Log complet côté serveur (visible dans les logs Supabase)
  console.error(`[${context}] Error occurred:`, {
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    type: error?.constructor?.name,
    timestamp: new Date().toISOString()
  });

  // Déterminer l'erreur safe à retourner
  let safeError: SafeError = {
    code: ErrorCode.INTERNAL_ERROR,
    message: 'An unexpected error occurred',
    statusCode: 500
  };

  if (error instanceof z.ZodError) {
    safeError = {
      code: ErrorCode.INVALID_INPUT,
      message: 'Invalid request data',
      statusCode: 400
    };
  } else if (error instanceof Error) {
    if (error.message.includes('not found')) {
      safeError = {
        code: ErrorCode.NOT_FOUND,
        message: 'Resource not found',
        statusCode: 404
      };
    } else if (error.message.includes('unauthorized') || error.message.includes('JWT')) {
      safeError = {
        code: ErrorCode.UNAUTHORIZED,
        message: 'Authentication required',
        statusCode: 401
      };
    } else if (error.message.includes('forbidden')) {
      safeError = {
        code: ErrorCode.FORBIDDEN,
        message: 'Access denied',
        statusCode: 403
      };
    }
  }

  return new Response(
    JSON.stringify({ error: safeError }),
    { 
      status: safeError.statusCode, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
};