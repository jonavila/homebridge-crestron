import { retry } from '../helpers';
import { BaseAccessory } from './BaseAccessory';
import { getPowerState, setPowerState } from './Callbacks';

export class LightSwitch extends BaseAccessory {
  constructor(log, accessoryConfig, platform) {
    super(log, accessoryConfig, platform);
  }

  getServices() {
    const { platform } = this;
    const { api } = platform;
    const {
      hap: { Characteristic, Service }
    } = api;

    const lightBulbService = new Service.Lightbulb();
    const powerState = lightBulbService
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

    this.lightBulbService = lightBulbService;

    api.on(`Event-${this.type}-${this.id}-Set-Power`, value => {
      powerState.updateValue(Boolean(value));
    });

    return [this.infoService, lightBulbService];
  }
}
