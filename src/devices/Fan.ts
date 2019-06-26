import { CharacteristicGetCallback, CharacteristicSetCallback, DeviceConfig, PlatformLogger, Request } from '../@types';
import { Platform } from '../Platform';
import { retry, sleep } from '../utils';
import { BaseDevice } from './BaseDevice';

export class Fan extends BaseDevice {
  setSpeedPending = false;
  setRequestDelay = 20;
  constructor(log: PlatformLogger, config: DeviceConfig, platform: Platform) {
    super(log, config, platform);

    const { id, type } = this.config;
    const { api } = this.platform;
    const {
      hap: { Characteristic, Service }
    } = api;

    const fanService = new Service.Fan(this.name, 'fan');
    fanService.isPrimaryService = true;
    this.services.push(fanService);

    const onCharacteristic = fanService
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

    const rotationSpeedCharacteristic = fanService
      .getCharacteristic(Characteristic.RotationSpeed)
      .setProps({
        format: Characteristic.Formats.FLOAT,
        maxValue: 100,
        minStep: 33.333,
        minValue: 0,
        perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY],
        unit: Characteristic.Units.PERCENTAGE
      })
      .on('get', async (callback: CharacteristicGetCallback) => {
        try {
          const request: Request = {
            DeviceId: id,
            DeviceType: type,
            MessageType: 'Request',
            Operation: 'Get',
            Property: 'Speed'
          };
          const speed = await retry(this.initRequest.bind<BaseDevice, Request, Promise<number>>(this, request));
          callback(null, speed);
        } catch (error) {
          callback(error, false);
        }
      })
      .on('set', async (speedPercentage, callback: CharacteristicSetCallback) => {
        try {
          const request: Request = {
            DeviceId: id,
            DeviceType: type,
            MessageType: 'Request',
            Operation: 'Set',
            Property: 'Speed',
            Value: Math.round(speedPercentage as number)
          };
          this.setSpeedPending = true;
          await sleep(this.setRequestDelay);
          await retry(this.initRequest.bind(this, request));
          callback();
        } catch (error) {
          callback(error);
        } finally {
          this.setSpeedPending = false;
        }
      });

    api.on(`Event-${type}-${id}-Set-Speed`, (speed: number) => {
      rotationSpeedCharacteristic.updateValue(speed);
    });
  }

  async isSetPowerValid() {
    if (!this.setSpeedPending) {
      await sleep(this.setRequestDelay);
    }

    return !this.setSpeedPending;
  }
}
