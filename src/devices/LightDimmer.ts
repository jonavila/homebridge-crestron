import { CharacteristicGetCallback, CharacteristicSetCallback, DeviceConfig, PlatformLogger, Request } from '../@types';
import { Platform } from '../Platform';
import { retry, sleep } from '../utils';
import { BaseDevice } from './BaseDevice';

export class LightDimmer extends BaseDevice {
  setLevelPending = false;
  setRequestDelay = 20;
  constructor(log: PlatformLogger, config: DeviceConfig, platform: Platform) {
    super(log, config, platform);

    const { id, type } = this.config;
    const { api } = this.platform;
    const {
      hap: { Characteristic, Service }
    } = api;

    const lightBulbService = new Service.Lightbulb(this.name, 'lightSwitch');
    lightBulbService.isPrimaryService = true;
    this.services.push(lightBulbService);

    const onCharacteristic = lightBulbService
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
          const isValid = await this.isSetPowerValid();

          if (isValid) {
            await retry(this.initRequest.bind(this, request));
          }
          callback();
        } catch (error) {
          callback(error);
        }
      });

    api.on(`Event-${type}-${id}-Set-Power`, (on: number) => {
      onCharacteristic.updateValue(Boolean(on));
    });

    const brightnessCharacteristic = lightBulbService
      .getCharacteristic(Characteristic.Brightness)
      .on('get', async (callback: CharacteristicGetCallback) => {
        try {
          const request: Request = {
            DeviceId: id,
            DeviceType: type,
            MessageType: 'Request',
            Operation: 'Get',
            Property: 'Level'
          };
          const level = await retry(this.initRequest.bind<BaseDevice, Request, Promise<number>>(this, request));
          callback(null, (level * 100) / 65535);
        } catch (error) {
          callback(error, false);
        }
      })
      .on('set', async (brightnessPercentage, callback: CharacteristicSetCallback) => {
        try {
          const request: Request = {
            DeviceId: id,
            DeviceType: type,
            MessageType: 'Request',
            Operation: 'Set',
            Property: 'Level',
            Value: ((brightnessPercentage as number) / 100) * 65535
          };
          this.setLevelPending = true;
          await sleep(this.setRequestDelay);
          await retry(this.initRequest.bind(this, request));
          callback();
        } catch (error) {
          callback(error);
        } finally {
          this.setLevelPending = false;
        }
      });

    api.on(`Event-${type}-${id}-Set-Level`, (level: number) => {
      brightnessCharacteristic.updateValue((level * 100) / 65535);
    });
  }

  async isSetPowerValid() {
    if (!this.setLevelPending) {
      await sleep(this.setRequestDelay);
    }

    return !this.setLevelPending;
  }
}
