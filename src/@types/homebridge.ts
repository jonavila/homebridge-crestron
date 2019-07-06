import HAPNodeJS from 'hap-nodejs';
import { EventEmitter } from 'events';

export type HAP = typeof HAPNodeJS;

export type Service = HAPNodeJS.Service;

export type Characteristic = HAPNodeJS.Characteristic;

export type AccessoryCategory = HAPNodeJS.Accessory.Categories;

export type CharacteristicGetCallback = HAPNodeJS.CharacteristicGetCallback;

export type CharacteristicSetCallback = HAPNodeJS.CharacteristicSetCallback;

export interface Homebridge extends EventEmitter {
  version: number;
  serverVersion: string;
  user: User;
  hap: HAP;
  platformAccessory: PlatformAccessory;

  accessory(name: string): Function;
  registerAccessory(
    pluginName: string,
    accessoryName: string,
    constructor: Function,
    configurationRequestHandler?: Function
  ): void;
  publishCameraAccessories(pluginName: string, accessories: PlatformAccessory[]): void;
  publishExternalAccessories(pluginName: string, accessories: PlatformAccessory[]): void;
  platform(name: string): Function;
  registerPlatform(pluginName: string, platformName: string, constructor: Function, dynamic?: boolean): void;
  registerPlatformAccessories(pluginName: string, platformName: string, accessories: PlatformAccessory[]): void;
}

export interface PlatformLogger {
  (message: string): void;

  prefix: string;
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  log: (level: LogLevel, message: string) => void;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface User {
  (): void;
  config: () => void;
  storagePath: () => string;
  configPath: () => string;
  persistPath: () => string;
  cachedAccessoryPath: () => string;
  setStoragePath: () => void;
}

interface PlatformAccessory extends EventEmitter {
  new (displayName: string, UUID: string, category?: AccessoryCategory): this;

  displayName: string;
  UUID: string;
  category: AccessoryCategory;
  services: Service[];
  reachable: boolean;

  addService(service: Service): Service;
  removeService(service: Service): void;
  getService(name: string | Service): Service | void;
  getServiceByUUIDAndSubType(UUID: string | Service, subType: string): Service | void;
  updateReachability(reachable: boolean): void;
}
