// src/types/api.ts

export interface ApiError {
  detail: string;
  status: number;
}

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}