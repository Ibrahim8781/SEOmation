import type { AxiosError } from 'axios';
import { isAxiosError } from 'axios';
import type { ApiErrorPayload } from '@/types';

export function extractErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isAxiosError<ApiErrorPayload>(error)) {
    return extractAxiosError(error, fallback);
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

function extractAxiosError(error: AxiosError<ApiErrorPayload>, fallback: string): string {
  const responseMessage = error.response?.data?.message;
  if (responseMessage) return responseMessage;
  if (error.message) return error.message;
  return fallback;
}
