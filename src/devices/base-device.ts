import { AccessoryPlugin, Logging, Service } from 'homebridge';
import { DeviceConfig, DeviceRequest } from '../types';
import { Platform } from '../platform';

export class BaseDevice implements AccessoryPlugin {
  log: Logging;
  config: DeviceConfig;
  platform: Platform;
  name: string;
  services: Service[];

  constructor(log: Logging, config: DeviceConfig, platform: Platform) {
    this.log = log;
    this.config = config;
    this.platform = platform;

    const { name, manufacturer, model } = this.config;
    const { homebridge } = this.platform;
    const {
      hap: { Characteristic, Service },
    } = homebridge;
    this.name = name;

    const infoService = new Service.AccessoryInformation();
    infoService
      .setCharacteristic(Characteristic.Manufacturer, manufacturer)
      .setCharacteristic(Characteristic.Model, model);

    this.services = [infoService];
  }

  getServices(): Service[] {
    return this.services;
  }

  async initRequest<T extends number | undefined>(
    request: DeviceRequest,
    timeout?: number,
  ): Promise<T> {
    const REQUEST_TIMEOUT = timeout || 3000;
    const { deviceId: id, deviceType: type, operation, property } = request;

    return new Promise<T>((resolve, reject) => {
      const { platform } = this;
      this.platform.sendRequest(request);

      const timeoutId = setTimeout(() => {
        platform.removeAllListeners(
          `Response-${type}-${id}-${operation}-${property}`,
        );
        const errorMessage = `The device ${this.name} failed to respond within ${REQUEST_TIMEOUT} ms. for the request ${operation} ${property}`;
        this.log.error(errorMessage);

        reject(Error(errorMessage));
      }, REQUEST_TIMEOUT);

      platform.once(
        `Response-${type}-${id}-${operation}-${property}`,
        (value: T) => {
          this.platform.removeRequest(request);
          clearTimeout(timeoutId);
          resolve(value);
        },
      );
    });
  }
}
