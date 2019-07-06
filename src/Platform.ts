import { each, groupBy } from 'lodash-es';
import net from 'net';
import { BaseDevice, Fan, GenericSwitch, LightDimmer, LightSwitch } from './devices';
import { DeviceType, Homebridge, PlatformConfig, PlatformLogger, Request } from './@types';

export class Platform {
  log: PlatformLogger;
  config: PlatformConfig;
  api: Homebridge;
  socket: net.Socket = new net.Socket();
  pendingGetRequests: Map<string, string> = new Map<string, string>();
  pendingSetRequests: Map<string, string> = new Map<string, string>();

  constructor(log: PlatformLogger, config: PlatformConfig, api: Homebridge) {
    this.log = log;
    this.config = config;
    this.api = api;
    const { host, port } = this.config;

    // logs socket error messages
    this.socket.on('error', this.log.error);

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
    this.api.on('didFinishLaunching', () => this.log('DidFinishLaunching'));
  }

  accessories(callback: (accessories: BaseDevice[]) => void) {
    const accessories: BaseDevice[] = [];
    const { devices } = this.config;
    const devicesByType = groupBy(devices, device => device.type);

    /*
      Here we register the accessories with Homebridge. We group the devices listed
      in the config file by type and we call the appropriate device constructor.
     */
    each(devicesByType, (devices, type) => {
      devices.forEach(config => {
        switch (type as DeviceType) {
          case 'LightSwitch':
            accessories.push(new LightSwitch(this.log, config, this));
            return;

          case 'LightDimmer':
            accessories.push(new LightDimmer(this.log, config, this));
            return;

          case 'GenericSwitch':
            accessories.push(new GenericSwitch(this.log, config, this));
            return;

          case 'Fan':
            accessories.push(new Fan(this.log, config, this));
            return;
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
  receiveResponses(data: Buffer) {
    const jsonMessages = data
      .toString()
      .split('||')
      .filter(jsonMessage => jsonMessage.length > 0);
    jsonMessages.forEach(jsonMessage => {
      const message = JSON.parse(jsonMessage);

      const {
        MessageType: messageType,
        DeviceType: deviceType,
        DeviceId: deviceId,
        Operation: operation,
        Property: property,
        Value: value
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
      if (messageType === 'Event' && this.pendingSetRequests.has(`${deviceType}-${deviceId}-${property}`)) {
        this.api.emit(`Response-${deviceType}-${deviceId}-${operation}-${property}`);

        return;
      }

      this.api.emit(`${messageType}-${deviceType}-${deviceId}-${operation}-${property}`, value);
    });
  }

  removeRequest(request: Request) {
    const { DeviceId: deviceId, DeviceType: deviceType, Operation: operation, Property: property } = request;
    const requestKey = `${deviceType}-${deviceId}-${property}`;

    if (operation === 'Get') {
      this.pendingGetRequests.delete(requestKey);
    } else {
      this.pendingSetRequests.delete(requestKey);
    }
  }

  sendRequest(request: Request) {
    const { DeviceId: deviceId, DeviceType: deviceType, Operation: operation, Property: property } = request;
    const requestKey = `${deviceType}-${deviceId}-${property}`;
    const requestBody = `${JSON.stringify(request)}||`;
    this.socket.write(requestBody);

    if (operation === 'Get') {
      this.pendingGetRequests.set(requestKey, requestBody);
    } else {
      this.pendingSetRequests.set(requestKey, requestBody);
    }
  }
}
