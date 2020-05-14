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

export class Television extends BaseDevice {
  constructor(log: Logging, config: DeviceConfig, platform: Platform) {
    super(log, config, platform);

    const { id, timeout, type } = this.config;
    const { homebridge } = this.platform;
    const {
      hap: { Characteristic, Service },
    } = homebridge;

    const televisionService = new Service.Television(this.name, 'television');
    televisionService.isPrimaryService = true;
    this.services.push(televisionService);

    televisionService
      .getCharacteristic(Characteristic.ActiveIdentifier)!
      .on(
        CharacteristicEventTypes.SET,
        (
          newValue: CharacteristicValue,
          callback: CharacteristicSetCallback,
        ) => {
          console.log('set Active Identifier => setNewValue: ' + newValue);
          callback(null);
        },
      );

    televisionService
      .setCharacteristic(Characteristic.ConfiguredName, this.name)
      .setCharacteristic(
        Characteristic.SleepDiscoveryMode,
        Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE,
      )
      .setCharacteristic(Characteristic.ActiveIdentifier, 1);

    televisionService
      .getCharacteristic(Characteristic.RemoteKey)
      .on(
        CharacteristicEventTypes.SET,
        (
          newValue: CharacteristicValue,
          callback: CharacteristicSetCallback,
        ) => {
          console.log('set Remote Key => setNewValue: ' + newValue);
          callback(null);
        },
      );

    const activeCharacteristic = televisionService
      .getCharacteristic(Characteristic.Active)
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
            const onValue = await retry(this.initRequest.bind(this, request));
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
            await retry(this.initRequest.bind(this, request, timeout));
            callback();
          } catch (error) {
            callback(error);
          }
        },
      );

    platform.on(`Event-${type}-${id}-Set-Power`, (on: number) => {
      activeCharacteristic.updateValue(Boolean(on));
    });

    // const activeIdentifierCharacteristic = televisionService
    //   .getCharacteristic(Characteristic.ActiveIdentifier)
    //   .on(
    //     CharacteristicEventTypes.GET,
    //     async (callback: CharacteristicSetCallback) => {
    //       try {
    //         const request: DeviceRequest = {
    //           deviceId: id,
    //           deviceType: type,
    //           messageType: 'Request',
    //           operation: 'Get',
    //           property: 'Source',
    //         };
    //         const onValue = await retry(
    //           this.initRequest.bind(this, request, timeout),
    //         );
    //         callback(null, onValue);
    //       } catch (error) {
    //         callback(error, false);
    //       }
    //     },
    //   )
    //   .on(
    //     CharacteristicEventTypes.SET,
    //     async (
    //       activeInput: CharacteristicValue,
    //       callback: CharacteristicSetCallback,
    //     ) => {
    //       try {
    //         const request: DeviceRequest = {
    //           deviceId: id,
    //           deviceType: type,
    //           messageType: 'Request',
    //           operation: 'Set',
    //           property: 'Source',
    //           value: activeInput as number,
    //         };
    //         await retry(this.initRequest.bind(this, request, timeout));
    //         callback();
    //       } catch (error) {
    //         callback(error);
    //       }
    //     },
    //   );
    //
    // platform.on(`Event-${type}-${id}-Set-Source`, (source: number) => {
    //   activeIdentifierCharacteristic.updateValue(source);
    // });

    // sources?.forEach((sourceConfig) => {
    //   const inputService = new Service.InputSource(
    //     sourceConfig.name,
    //     `inputSource${sourceConfig.id}`,
    //   )
    //     .setCharacteristic(Characteristic.Identifier, sourceConfig.id)
    //     .setCharacteristic(Characteristic.ConfiguredName, sourceConfig.name)
    //     .setCharacteristic(
    //       Characteristic.IsConfigured,
    //       Characteristic.IsConfigured.CONFIGURED,
    //     )
    //     .setCharacteristic(Characteristic.InputSourceType, 3);
    //
    //   televisionService.addLinkedService(inputService);
    //   this.services.push(inputService);
    // });
  }
}
