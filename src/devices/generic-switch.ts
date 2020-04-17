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

export class GenericSwitch extends BaseDevice {
  constructor(log: Logging, config: DeviceConfig, platform: Platform) {
    super(log, config, platform);

    const { id, type } = this.config;
    const { homebridge } = this.platform;
    const {
      hap: { Characteristic, Service },
    } = homebridge;

    const switchService = new Service.Switch(this.name, 'genericSwitch');
    switchService.isPrimaryService = true;
    this.services.push(switchService);

    const onCharacteristic = switchService
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
              Value: (on as number) ? 1 : 0,
            };
            await retry(this.initRequest.bind(this, request));
            callback();
          } catch (error) {
            callback(error);
          }
        },
      );

    platform.on(`Event-${type}-${id}-Set-Power`, (on: number) => {
      onCharacteristic?.updateValue(Boolean(on));
    });
  }
}
