import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorCode, ErrorCodeValue, statusToCode } from './error-codes';

interface ErrorBody {
  statusCode: number;
  code: ErrorCodeValue;
  message: string;
  details: Record<string, unknown>;
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toErrorBody(exception);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception);
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown): ErrorBody {
    if (!(exception instanceof HttpException)) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Ocurrio un error inesperado.',
        details: {},
      };
    }

    const statusCode = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return {
        statusCode,
        code: statusToCode[statusCode] ?? ErrorCode.INTERNAL_ERROR,
        message: payload,
        details: {},
      };
    }

    const record = payload as Record<string, unknown>;
    const rawMessage = record.message;

    return {
      statusCode,
      code:
        (record.code as ErrorCodeValue) ??
        statusToCode[statusCode] ??
        ErrorCode.INTERNAL_ERROR,
      message: Array.isArray(rawMessage)
        ? 'Datos invalidos.'
        : ((rawMessage as string) ?? exception.message),
      details: Array.isArray(rawMessage)
        ? { fields: rawMessage }
        : ((record.details as Record<string, unknown>) ?? {}),
    };
  }
}
