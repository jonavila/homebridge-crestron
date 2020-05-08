import { PlatformConfig as HomebridgePlatformConfig } from 'homebridge';

export interface PlatformConfig extends HomebridgePlatformConfig {
  host: string;
  port: number;
  devices: DeviceConfig[];
}

export interface DeviceConfig {
  id: number;
  type: DeviceType;
  name: string;
  manufacturer: string;
  model: string;
}

// type TelevisionSourceConfig = {
//   id: number;
//   type: number;
//   name: string;
// };

export type DeviceType =
  | 'LightSwitch'
  | 'LightDimmer'
  | 'GenericSwitch'
  | 'Fan'
  | 'Television';

export interface DeviceRequest {
  deviceId: number;
  deviceType: DeviceType;
  messageType: 'Request';
  operation: RequestOperation;
  property: RequestProperty;
  value?: number | string;
}

type RequestOperation = 'Get' | 'Set';

export type RequestProperty = 'Power' | 'Level' | 'Speed' /* | 'Source'*/;
