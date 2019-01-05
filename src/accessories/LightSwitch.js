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
      .on('get', getPowerState.bind(this))
      .on('set', setPowerState.bind(this));

    this.lightBulbService = lightBulbService;

    api.on(`Event-${this.type}-${this.id}-Set-Power`, value => {
      powerState.updateValue(Boolean(value));
    });

    return [this.infoService, lightBulbService];
  }
}
