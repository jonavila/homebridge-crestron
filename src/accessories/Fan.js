import { retry } from '../helpers';
import { BaseAccessory } from './BaseAccessory';
import {
  getFanSpeed,
  getPowerState,
  setFanSpeed,
  setPowerState
} from './Callbacks';

export class Fan extends BaseAccessory {
  constructor(log, accessoryConfig, platform) {
    super(log, accessoryConfig, platform);
  }

  getServices() {
    const { platform } = this;
    const { api } = platform;
    const {
      hap: { Characteristic, Service }
    } = api;

    const fanService = new Service.Fan();
    const powerState = fanService
      .getCharacteristic(Characteristic.On)
      .on('get', callback => {
        retry(
          {
            fn: getPowerState.bind(this),
            retriesLeft: this.retries,
            timeout: this.getTimeout
          },
          callback
        );
      })
      .on('set', (powered, callback) => {
        retry(
          {
            fn: setPowerState.bind(this),
            retriesLeft: this.retries,
            timeout: this.setTimeout
          },
          powered,
          callback
        );
      });

    const fanSpeed = fanService
      .getCharacteristic(Characteristic.RotationSpeed)
      .on('get', callback => {
        retry(
          {
            fn: getFanSpeed.bind(this),
            retriesLeft: this.retries,
            timeout: this.getTimeout
          },
          callback
        );
      })
      .on('set', (speed, callback) => {
        retry(
          {
            fn: setFanSpeed.bind(this),
            retriesLeft: this.retries,
            timeout: this.setTimeout
          },
          speed,
          callback
        );
      });

    this.fanService = fanService;

    api.on(`Event-${this.type}-${this.id}-Set-Power`, value => {
      powerState.updateValue(Boolean(value));
    });

    api.on(`Event-${this.type}-${this.id}-Set-Speed`, value => {
      fanSpeed.updateValue(value);
    });

    return [this.infoService, fanService];
  }
}
