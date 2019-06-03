import { retry } from '../helpers';
import { BaseAccessory } from './BaseAccessory';
import { getPowerState, setPowerState } from './Callbacks';

export class GenericSwitch extends BaseAccessory {
  constructor(log, accessoryConfig, platform) {
    super(log, accessoryConfig, platform);
  }

  getServices() {
    const { platform } = this;
    const { api } = platform;
    const {
      hap: { Characteristic, Service }
    } = api;

    const switchService = new Service.Switch();
    const powerState = switchService
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

    this.switchService = switchService;

    api.on(`Event-${this.type}-${this.id}-Set-Power`, value => {
      powerState.updateValue(Boolean(value));
    });

    return [this.infoService, switchService];
  }
}
