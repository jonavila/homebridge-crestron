import { BaseDevice } from './BaseDevice';
import { CharacteristicGetCallback, CharacteristicSetCallback, DeviceConfig, PlatformLogger, Request } from '../@types';
import { Platform } from '../Platform';
import { retry } from '../utils';

export class GenericSwitch extends BaseDevice {
  constructor(log: PlatformLogger, config: DeviceConfig, platform: Platform) {
    super(log, config, platform);

    const { id, type } = this.config;
    const { api } = this.platform;
    const {
      hap: { Characteristic, Service }
    } = api;

    const switchService = new Service.Switch(this.name, 'genericSwitch');
    switchService.isPrimaryService = true;
    this.services.push(switchService);

    const onCharacteristic = switchService
      .getCharacteristic(Characteristic.On)
      .on('get', async (callback: CharacteristicGetCallback) => {
        try {
          const request: Request = {
            DeviceId: id,
            DeviceType: type,
            MessageType: 'Request',
            Operation: 'Get',
            Property: 'Power'
          };
          const onValue = await retry(this.initRequest.bind<BaseDevice, Request, Promise<number>>(this, request));
          callback(null, Boolean(onValue));
        } catch (error) {
          callback(error, false);
        }
      })
      .on('set', async (on, callback: CharacteristicSetCallback) => {
        try {
          const request: Request = {
            DeviceId: id,
            DeviceType: type,
            MessageType: 'Request',
            Operation: 'Set',
            Property: 'Power',
            Value: (on as number) ? 1 : 0
          };
          await retry(this.initRequest.bind(this, request));
          callback();
        } catch (error) {
          callback(error);
        }
      });

    api.on(`Event-${type}-${id}-Set-Power`, (on: number) => {
      onCharacteristic.updateValue(Boolean(on));
    });
  }
}
