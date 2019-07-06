export * from './homebridge';

/**
 * Config
 */

export interface PlatformConfig {
  platform: string;
  name: string;
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

export type DeviceType = 'LightSwitch' | 'LightDimmer' | 'GenericSwitch' | 'Fan' | 'Television';

/**
 * Platform
 */

export interface Request {
  DeviceId: number;
  DeviceType: DeviceType;
  MessageType: 'Request';
  Operation: RequestOperation;
  Property: RequestProperty;
  Value?: number | string;
}

type RequestOperation = 'Get' | 'Set';

export type RequestProperty = 'Power' | 'Level' | 'Speed';
