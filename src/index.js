import { Platform } from './Platform';

export default function(homebridge) {
  homebridge.registerPlatform('homebridge-crestron', 'Crestron', Platform);
}
