import { Platform } from './Platform';
import { Homebridge } from './@types';

export default function(homebridge: Homebridge) {
  homebridge.registerPlatform('homebridge-crestron', 'Crestron', Platform);
}
