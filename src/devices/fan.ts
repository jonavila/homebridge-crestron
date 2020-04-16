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

export class Fan extends BaseDevice {
  setSpeedPending = false;
  setRequestDelay = 20;
  constructor(log: Logging, config: DeviceConfig, platform: Platform) {
    super(log, config, platform);

    const { id, type } = this.config;
    const { api } = this.platform;
    const {
      hap: { Characteristic, Service },
    } = api;

    const fanService = new Service.Fan(this.name, 'fan');
    fanService.isPrimaryService = true;
    this.services.push(fanService);

    const onCharacteristic = fanService
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

    const rotationSpeedCharacteristic = fanService
      .getCharacteristic(Characteristic.RotationSpeed)
      ?.setProps({
        format: Characteristic.Formats.FLOAT,
        maxValue: 100,
        minStep: 33.333,
        minValue: 0,
        perms: [
          Characteristic.Perms.READ,
          Characteristic.Perms.WRITE,
          Characteristic.Perms.NOTIFY,
        ],
        unit: Characteristic.Units.PERCENTAGE,
      })
      .on(
        CharacteristicEventTypes.GET,
        async (callback: CharacteristicGetCallback) => {
          try {
            const request: DeviceRequest = {
              DeviceId: id,
              DeviceType: type,
              MessageType: 'Request',
              Operation: 'Get',
              Property: 'Speed',
            };
            const speed = await retry(
              this.initRequest.bind<BaseDevice, DeviceRequest, Promise<number>>(
                this,
                request,
              ),
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
              DeviceId: id,
              DeviceType: type,
              MessageType: 'Request',
              Operation: 'Set',
              Property: 'Speed',
              Value: Math.round(speedPercentage as number),
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
        },
      );

    api.on(`Event-${type}-${id}-Set-Speed`, (speed: number) => {
      rotationSpeedCharacteristic?.updateValue(speed);
    });
  }

  async isSetPowerValid() {
    if (!this.setSpeedPending) {
      await sleep(this.setRequestDelay);
    }

    return !this.setSpeedPending;
  }
}
