import { apiPost } from './client';

export interface RegisterDeviceResponse {
  status: 'registered' | 'already_registered';
}

export const registerDevice = (deviceId: string) =>
  apiPost<RegisterDeviceResponse>('/devices/register', { device_id: deviceId });