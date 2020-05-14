import { API } from 'homebridge';
import { Platform } from './platform';

export default function (homebridge: API) {
  homebridge.registerPlatform('Crestron', Platform);
}
