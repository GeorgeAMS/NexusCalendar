import { HttpException, HttpStatus } from '@nestjs/common';

export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  ACCOUNT_PENDING: 'ACCOUNT_PENDING',
  ACCOUNT_REJECTED: 'ACCOUNT_REJECTED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  ROOM_CONFLICT: 'ROOM_CONFLICT',
  ADVANCE_NOTICE: 'ADVANCE_NOTICE',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends HttpException {
  constructor(
    code: ErrorCodeValue,
    message: string,
    status: HttpStatus,
    details?: Record<string, unknown>,
  ) {
    super({ code, message, details: details ?? {} }, status);
  }
}

export const statusToCode: Record<number, ErrorCodeValue> = {
  400: ErrorCode.VALIDATION_ERROR,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
};
