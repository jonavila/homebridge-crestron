import net from 'net';
import {
  AccessoryPlugin,
  API,
  Logging,
  StaticPlatformPlugin,
} from 'homebridge';
import { DeviceRequest, DeviceType, PlatformConfig } from './types';
import { EventEmitter } from 'events';
import {
  Fan,
  GenericSwitch,
  LightDimmer,
  LightSwitch,
  Television,
} from './devices';
import { forEach, groupBy } from 'lodash';
import { parseJSON } from './utils';

export class Platform extends EventEmitter implements StaticPlatformPlugin {
  log: Logging;
  config: PlatformConfig;
  homebridge: API;
  socket: net.Socket = new net.Socket();
  pendingGetRequests: Map<string, string> = new Map<string, string>();
  pendingSetRequests: Map<string, string> = new Map<string, string>();
  private bufferedData: string = '';

  constructor(log: Logging, config: PlatformConfig, api: API) {
    super();
    this.log = log;
    this.config = config;
    this.homebridge = api;
    const { host, port } = this.config;

    // logs socket error messages
    this.socket.on('error', (error) => {
      this.log.error(error.message);
    });

    //handle socket close
    this.socket.on('close', () => {
      this.log('Connection Lost. Attempting to reconnect in 10 seconds...');
      this.socket.setTimeout(10000, () => {
        this.socket.connect(port, host, () => {
          this.log('Connection re-established with the Crestron Processor');
        });
      });
    });

    // connect to the Crestron processor
    this.socket.connect(port, host, () => {
      this.log(`Connected to the Crestron Processor @ ${host}`);
    });

    // handle socket data
    this.socket.on('data', this.receiveResponses.bind(this));

    // handle program termination
    process.on('exit', () => {
      this.socket.end();
      this.log('Disconnected from the Crestron Processor');
    });

    // handle Homebridge launch
    this.homebridge.on('didFinishLaunching', () =>
      this.log('DidFinishLaunching'),
    );
  }

  accessories(callback: (accessories: AccessoryPlugin[]) => void): void {
    const accessories: AccessoryPlugin[] = [];
    const { devices } = this.config;
    const devicesByType = groupBy(devices, (device) => device.type);

    /*
      Here we register the accessories with Homebridge. We group the devices listed
      in the config file by type and we call the appropriate device constructor.
     */
    forEach(devicesByType, (devices, type) => {
      devices.forEach((config) => {
        let accessory;
        switch (type as DeviceType) {
          case 'LightSwitch':
            accessory = new LightSwitch(this.log, config, this);
            break;

          case 'LightDimmer':
            accessory = new LightDimmer(this.log, config, this);
            break;

          case 'GenericSwitch':
            accessory = new GenericSwitch(this.log, config, this);
            break;

          case 'Fan':
            accessory = new Fan(this.log, config, this);
            break;

          case 'Television':
            accessory = new Television(this.log, config, this);
            break;

          default:
            this.log.warn(
              `Unable to find an accessory constructor for device: ${config.name} with type: ${config.type}`,
            );
            break;
        }

        if (accessory) {
          accessories.push(accessory);
        }
      });
    });

    callback(accessories);
  }

  /*
    Handle messages received from Crestron
    Since messages are received in a TCP socket stream, we use a double-pipe (||)
    to delimit them. We split the stream and retain messages where length > 0
 */
  receiveResponses(data: Buffer): void {
    this.bufferedData += data;
    let received = this.bufferedData.split('\n');

    while (received.length > 1) {
      this.processMessage(received[0]);
      this.bufferedData = received.slice(1).join('\n');
      received = this.bufferedData.split('\n');
    }
  }

  processMessage(jsonMessage: string) {
    const message = parseJSON(jsonMessage);

    if (message instanceof Error) {
      this.log.error(message.message);
      return;
    }

    const {
      MessageType: messageType,
      DeviceType: deviceType,
      DeviceId: deviceId,
      Operation: operation,
      Property: property,
      Value: value,
    } = message;

    /*
      When Homebridge sends a message with a `Set` operation, the Crestron
      module will pulse DIGITAL_OUTPUT or a ANALOG_OUTPUT signals. These
      signals will trigger commands on the connected devices and feedback
      from those devices will generate `Event` messages back to Homebridge.

      Upon receiving an `Event` message, we check if a `Set` request is pending
      for that device. If the pending request exists, we emit a `Response` event
      so that Homebridge receives the acknowledgement from Crestron that the
      message was processed.

      If an `Event` message is received and there are no pending `Set` requests,
      this means that an event occurred on the Crestron side from an action
      not triggered by Homebridge (e.g. Keypad press). In this case, we emit a
      `Event` message and handle it accordingly.
     */
    if (
      messageType === 'Event' &&
      this.pendingSetRequests.has(`${deviceType}-${deviceId}-${property}`)
    ) {
      this.emit(`Response-${deviceType}-${deviceId}-${operation}-${property}`);

      return;
    }

    this.emit(
      `${messageType}-${deviceType}-${deviceId}-${operation}-${property}`,
      value,
    );
  }

  removeRequest(request: DeviceRequest): void {
    const { deviceId, deviceType, operation, property } = request;
    const requestKey = `${deviceType}-${deviceId}-${property}`;

    if (operation === 'Get') {
      this.pendingGetRequests.delete(requestKey);
    } else {
      this.pendingSetRequests.delete(requestKey);
    }
  }

  sendRequest(request: DeviceRequest): void {
    const { deviceId, deviceType, operation, property } = request;
    const requestKey = `${deviceType}-${deviceId}-${property}`;
    const requestBody = JSON.stringify(request) + '\n';
    this.socket.write(requestBody);

    if (operation === 'Get') {
      this.pendingGetRequests.set(requestKey, requestBody);
    } else {
      this.pendingSetRequests.set(requestKey, requestBody);
    }
  }
}
