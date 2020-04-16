import { HomebridgeAPI } from 'homebridge/lib/api';
import { Platform } from './platform';

export default function (homebridge: HomebridgeAPI) {
  homebridge.registerPlatform(
    '@jonavila/homebridge-crestron',
    'Crestron',
    // @ts-ignore
    Platform,
  );
}
