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
import { retry } from '../utils';

export class LightSwitch extends BaseDevice {
  constructor(log: Logging, config: DeviceConfig, platform: Platform) {
    super(log, config, platform);

    const { id, type } = this.config;
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
              deviceId: id,
              deviceType: type,
              messageType: 'Request',
              operation: 'Set',
              property: 'Power',
              value: on ? 1 : 0,
            };
            await retry(this.initRequest.bind(this, request));
            callback();
          } catch (error) {
            callback(error);
          }
        },
      );

    platform.on(`Event-${type}-${id}-Set-Power`, (on: number) => {
      onCharacteristic.updateValue(Boolean(on));
    });
  }
}
