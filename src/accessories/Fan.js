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
      .on('get', getPowerState.bind(this))
      .on('set', setPowerState.bind(this));

    const fanSpeed = fanService
      .getCharacteristic(Characteristic.RotationSpeed)
      .on('get', getFanSpeed.bind(this))
      .on('set', setFanSpeed.bind(this));

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
