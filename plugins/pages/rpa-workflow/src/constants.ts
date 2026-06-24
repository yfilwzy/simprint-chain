export const ITEMS_PER_PAGE = 10;

export const API_ENDPOINTS = {
  WORKFLOWS: '/api/v1/rpa/workflows',
  RUN: (id: string) => `/api/v1/rpa/workflows/${id}/run`,
  STOP: (id: string) => `/api/v1/rpa/workflows/${id}/stop`,
  DELETE: (id: string) => `/api/v1/rpa/workflows/${id}`,
  DUPLICATE: (id: string) => `/api/v1/rpa/workflows/${id}/duplicate`,
  BATCH_RUN: '/api/v1/rpa/workflows/batch-run',
  BATCH_DELETE: '/api/v1/rpa/workflows/batch-delete',
} as const;
