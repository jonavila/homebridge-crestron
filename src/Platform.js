import { each, groupBy } from 'lodash-es';
import net from 'net';
import { GenericSwitch } from './accessories/GenericSwitch';
import { LightDimmer } from './accessories/LightDimmer';
import { LightSwitch } from './accessories/LightSwitch';

export class Platform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api; // store the api in the Platform instance
    const { host, port } = this.config;

    this.socket = new net.Socket();
    this.socket.pendingGetRequests = new Map(); // stores outgoing get messages
    this.socket.pendingSetRequests = new Map(); // stores outgoing set messages

    this.socket.on('error', console.error); // logs socket error messages

    //handle socket close
    this.socket.on('close', () => {
      this.log('Connection Lost. Attempting to reconnect in 10 seconds...');
      this.socket.setTimeout(10000, () => {
        this.socket.connect(
          port,
          host,
          () => {
            this.log('Connection re-established with the Crestron Processor');
          }
        );
      });
    });

    // connect to the Crestron processor
    this.socket.connect(
      port,
      host,
      () => {
        this.log(`Connected to the Crestron Processor @ ${host}`);
      }
    );

    /*
      Handle messages received from Crestron
      Since messages are received in a TCP socket stream, we use a double-pipe (||)
      to delimit them. We split the stream and retain messages where length > 0
     */
    this.socket.on('data', data => {
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
          from those devices will be generate `Event` messages back to Homebridge.
          
          Upon receiving an `Event` message, we check if a `Set` request is pending
          for that device. If the pending request exists, we emit a `Response` event
          so that Homebridge receives the acknowledgement from Crestron that the 
          message was processes.
          
          If an `Event` message is received and there are no pending `Set` requests,
          this means that an event occurred on the Crestron side from an action
          not triggered by Homebridge (e.g. Keypad press). In this case, we emit a
          `Event` event and handle it accordingly. 
         */
        if (
          messageType === 'Event' &&
          this.socket.pendingSetRequests.has(
            `${deviceType}-${deviceId}-${property}`
          )
        ) {
          this.api.emit(
            `Response-${deviceType}-${deviceId}-${operation}-${property}`
          );

          return;
        }

        this.api.emit(
          `${messageType}-${deviceType}-${deviceId}-${operation}-${property}`,
          value
        );
      });
    });

    // handle program termination
    process.on('exit', () => {
      this.socket.end();
      this.log('Disconnected from the Crestron Processor');
    });

    // handle Homebridge launch
    this.api.on(
      'didFinishLaunching',
      function() {
        this.log('DidFinishLaunching');
      }.bind(this)
    );
  }

  accessories(callback) {
    const accessories = [];
    const { devices } = this.config;
    const devicesByType = groupBy(devices, 'type');

    /*
      Here we register the devices with Homebridge. We group the devices listed
      in the config file by type and we call the appropriate accessory constructor.
     */
    each(devicesByType, (devices, type) => {
      devices.forEach(device => {
        switch (type) {
          case 'LightSwitch':
            accessories.push(new LightSwitch(this.log, device, this));
            return;

          case 'LightDimmer':
            accessories.push(new LightDimmer(this.log, device, this));
            return;

          case 'GenericSwitch':
            accessories.push(new GenericSwitch(this.log, device, this));
            return;
        }
      });
    });

    callback(accessories);
  }
}
