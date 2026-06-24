import { invoke } from '@/lib/tauri';

export interface CdpEndpoint {
  env_uuid: string;
  host: string;
  port: number;
  version_url: string;
  list_url: string;
  browser_ws_url?: string;
}

export type EnvironmentStatus =
  | 'initializing'
  | 'verifying'
  | 'downloading'
  | 'extracting'
  | 'ready'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error';

export interface EnvConnectionPayload {
  env_id: string;
  status: 'connected' | 'disconnected';
}

export const ENV_CONNECTION_STATUS_EVENT = 'env-connection-status';

export async function getEnvironmentCdpEndpoint(envUuid: string): Promise<CdpEndpoint | null> {
  return invoke<CdpEndpoint | null>('get_environment_cdp_endpoint', { envUuid });
}

export async function getEnvironmentStatus(envUuid: string): Promise<EnvironmentStatus | null> {
  return invoke<EnvironmentStatus | null>('get_environment_status', { envUuid });
}
