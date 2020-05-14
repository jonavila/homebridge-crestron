import { BaseDevice } from './base-device';
import {
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  Logging,
} from 'homebridge';
import { DeviceConfig, DeviceRequest } from '../types';
import { Platform } from '../platform';
import { retry, sleep } from '../utils';

export class LightDimmer extends BaseDevice {
  setLevelPending = false;
  setRequestDelay = 20;

  constructor(log: Logging, config: DeviceConfig, platform: Platform) {
    super(log, config, platform);

    const { id, timeout, type } = this.config;
    const { homebridge } = this.platform;
    const {
      hap: { Characteristic, Service },
    } = homebridge;

    const lightBulbService = new Service.Lightbulb(this.name, 'lightSwitch');
    lightBulbService.isPrimaryService = true;
    this.services.push(lightBulbService);

    const onCharacteristic = lightBulbService
      .getCharacteristic(Characteristic.On)
      .on(
        CharacteristicEventTypes.GET,
        async (callback: CharacteristicGetCallback) => {
          try {
            const request: DeviceRequest = {
              deviceId: id,
              deviceType: type,
              messageType: 'Request',
              operation: 'Get',
              property: 'Power',
            };
            const onValue = await retry(
              this.initRequest.bind(this, request, timeout),
            );
            callback(null, Boolean(onValue));
          } catch (error) {
            callback(error, false);
          }
        },
      )
      .on(
        CharacteristicEventTypes.SET,
        async (
          on: CharacteristicValue,
          callback: CharacteristicSetCallback,
        ) => {
          try {
            const request: DeviceRequest = {
              deviceId: id,
              deviceType: type,
              messageType: 'Request',
              operation: 'Set',
              property: 'Power',
              value: on ? 1 : 0,
            };
            const isValid = await this.isSetPowerValid();

            if (isValid) {
              await retry(this.initRequest.bind(this, request, timeout));
            }
            callback();
          } catch (error) {
            callback(error);
          }
        },
      );

    platform.on(`Event-${type}-${id}-Set-Power`, (on: number) => {
      onCharacteristic.updateValue(Boolean(on));
    });

    const brightnessCharacteristic = lightBulbService
      .getCharacteristic(Characteristic.Brightness)
      .on(
        CharacteristicEventTypes.GET,
        async (callback: CharacteristicGetCallback) => {
          try {
            const request: DeviceRequest = {
              deviceId: id,
              deviceType: type,
              messageType: 'Request',
              operation: 'Get',
              property: 'Level',
            };
            const level = await retry(
              this.initRequest.bind(this, request, timeout, timeout),
            );
            callback(null, (level! * 100) / 65535);
          } catch (error) {
            callback(error, false);
          }
        },
      )
      .on(
        CharacteristicEventTypes.SET,
        async (
          brightnessPercentage: CharacteristicValue,
          callback: CharacteristicSetCallback,
        ) => {
          try {
            const request: DeviceRequest = {
              deviceId: id,
              deviceType: type,
              messageType: 'Request',
              operation: 'Set',
              property: 'Level',
              value: ((brightnessPercentage as number) / 100) * 65535,
            };
            this.setLevelPending = true;
            await sleep(this.setRequestDelay);
            await retry(this.initRequest.bind(this, request, timeout));
            callback();
          } catch (error) {
            callback(error);
          } finally {
            this.setLevelPending = false;
          }
        },
      );

    platform.on(`Event-${type}-${id}-Set-Level`, (level: number) => {
      brightnessCharacteristic.updateValue((level * 100) / 65535);
    });
  }

  async isSetPowerValid(): Promise<boolean> {
    if (!this.setLevelPending) {
      await sleep(this.setRequestDelay);
    }

    return !this.setLevelPending;
  }
}
