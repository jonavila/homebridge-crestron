import { BaseDevice } from './base-device';
import {
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  Formats,
  Logging,
  Perms,
  Units,
} from 'homebridge';
import { DeviceConfig, DeviceRequest } from '../types';
import { Platform } from '../platform';
import { retry, sleep } from '../utils';

export class Fan extends BaseDevice {
  setSpeedPending = false;
  setRequestDelay = 20;
  constructor(log: Logging, config: DeviceConfig, platform: Platform) {
    super(log, config, platform);

    const { id, timeout, type } = this.config;
    const { homebridge } = platform;
    const {
      hap: { Characteristic, Service },
    } = homebridge;

    const fanService = new Service.Fan(this.name, 'fan');
    fanService.isPrimaryService = true;
    this.services.push(fanService);

    const onCharacteristic = fanService
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
              value: (on as number) ? 1 : 0,
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

    const rotationSpeedCharacteristic = fanService
      .getCharacteristic(Characteristic.RotationSpeed)
      .setProps({
        format: Formats.FLOAT,
        maxValue: 100,
        minStep: 33.333,
        minValue: 0,
        perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE, Perms.NOTIFY],
        unit: Units.PERCENTAGE,
      })
      .on(
        CharacteristicEventTypes.GET,
        async (callback: CharacteristicGetCallback) => {
          try {
            const request: DeviceRequest = {
              deviceId: id,
              deviceType: type,
              messageType: 'Request',
              operation: 'Get',
              property: 'Speed',
            };
            const speed = await retry(
              this.initRequest.bind(this, request, timeout),
            );
            callback(null, speed);
          } catch (error) {
            callback(error, false);
          }
        },
      )
      .on(
        CharacteristicEventTypes.SET,
        async (
          speedPercentage: CharacteristicValue,
          callback: CharacteristicSetCallback,
        ) => {
          try {
            const request: DeviceRequest = {
              deviceId: id,
              deviceType: type,
              messageType: 'Request',
              operation: 'Set',
              property: 'Speed',
              value: Math.round(speedPercentage as number),
            };
            this.setSpeedPending = true;
            await sleep(this.setRequestDelay);
            await retry(this.initRequest.bind(this, request, timeout));
            callback();
          } catch (error) {
            callback(error);
          } finally {
            this.setSpeedPending = false;
          }
        },
      );

    platform.on(`Event-${type}-${id}-Set-Speed`, (speed: number) => {
      rotationSpeedCharacteristic.updateValue(speed);
    });
  }

  async isSetPowerValid(): Promise<boolean> {
    if (!this.setSpeedPending) {
      await sleep(this.setRequestDelay);
    }

    return !this.setSpeedPending;
  }
}
