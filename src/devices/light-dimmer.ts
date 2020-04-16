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

    const { id, type } = this.config;
    const { api } = this.platform;
    const {
      hap: { Characteristic, Service },
    } = api;

    const lightBulbService = new Service.Lightbulb(this.name, 'lightSwitch');
    lightBulbService.isPrimaryService = true;
    this.services.push(lightBulbService);

    const onCharacteristic = lightBulbService
      .getCharacteristic(Characteristic.On)
      ?.on(
        CharacteristicEventTypes.GET,
        async (callback: CharacteristicGetCallback) => {
          try {
            const request: DeviceRequest = {
              DeviceId: id,
              DeviceType: type,
              MessageType: 'Request',
              Operation: 'Get',
              Property: 'Power',
            };
            const onValue = await retry(
              this.initRequest.bind<BaseDevice, DeviceRequest, Promise<number>>(
                this,
                request,
              ),
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
              DeviceId: id,
              DeviceType: type,
              MessageType: 'Request',
              Operation: 'Set',
              Property: 'Power',
              Value: on ? 1 : 0,
            };
            const isValid = await this.isSetPowerValid();

            if (isValid) {
              await retry(this.initRequest.bind(this, request));
            }
            callback();
          } catch (error) {
            callback(error);
          }
        },
      );

    api.on(`Event-${type}-${id}-Set-Power`, (on: number) => {
      onCharacteristic?.updateValue(Boolean(on));
    });

    const brightnessCharacteristic = lightBulbService
      .getCharacteristic(Characteristic.Brightness)
      ?.on(
        CharacteristicEventTypes.GET,
        async (callback: CharacteristicGetCallback) => {
          try {
            const request: DeviceRequest = {
              DeviceId: id,
              DeviceType: type,
              MessageType: 'Request',
              Operation: 'Get',
              Property: 'Level',
            };
            const level = await retry(
              this.initRequest.bind<BaseDevice, DeviceRequest, Promise<number>>(
                this,
                request,
              ),
            );
            callback(null, (level * 100) / 65535);
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
              DeviceId: id,
              DeviceType: type,
              MessageType: 'Request',
              Operation: 'Set',
              Property: 'Level',
              Value: ((brightnessPercentage as number) / 100) * 65535,
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
        },
      );

    api.on(`Event-${type}-${id}-Set-Level`, (level: number) => {
      brightnessCharacteristic?.updateValue((level * 100) / 65535);
    });
  }

  async isSetPowerValid() {
    if (!this.setLevelPending) {
      await sleep(this.setRequestDelay);
    }

    return !this.setLevelPending;
  }
}
