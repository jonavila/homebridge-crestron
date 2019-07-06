import { DeviceConfig, PlatformLogger, Request, Service } from '../@types';
import { Platform } from '../Platform';

export class BaseDevice {
  log: PlatformLogger;
  config: DeviceConfig;
  platform: Platform;
  name: string;
  services: Service[];

  constructor(log: PlatformLogger, config: DeviceConfig, platform: Platform) {
    this.log = log;
    this.config = config;
    this.platform = platform;

    const { name, manufacturer, model } = this.config;
    const {
      hap: { Characteristic, Service }
    } = this.platform.api;
    this.name = name;

    const infoService = new Service.AccessoryInformation(name, 'info');
    infoService
      .setCharacteristic(Characteristic.Manufacturer, manufacturer)
      .setCharacteristic(Characteristic.Model, model);

    this.services = [infoService];
  }

  getServices() {
    return this.services;
  }

  identify(callback: () => void) {
    callback();
  }

  async initRequest<T extends number | undefined>(request: Request): Promise<T> {
    const REQUEST_TIMEOUT = 2000;
    const { DeviceId: id, DeviceType: type, Operation: operation, Property: property, Value: value } = request;

    return new Promise<T>((resolve, reject) => {
      const { api } = this.platform;
      this.platform.sendRequest(request);

      const timeoutId = setTimeout(() => {
        api.removeAllListeners(`Response-${type}-${id}-${operation}-${property}`);
        const errorMessage = `The device ${this.name} failed to respond within ${REQUEST_TIMEOUT} ms. for the request ${operation} ${property}`;
        this.log.error(errorMessage);

        reject(Error(errorMessage));
      }, REQUEST_TIMEOUT);

      api.once(`Response-${type}-${id}-${operation}-${property}`, (value: T) => {
        this.platform.removeRequest(request);
        clearTimeout(timeoutId);
        resolve(value);
      });
    });
  }
}
