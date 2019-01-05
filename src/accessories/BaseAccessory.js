export class BaseAccessory {
  constructor(log, accessoryConfig, platform) {
    this.log = log;
    this.id = accessoryConfig.id;
    this.type = accessoryConfig.type;
    this.name = accessoryConfig.name;
    this.manufacturer = accessoryConfig.manufacturer;
    this.model = accessoryConfig.model;
    this.platform = platform;
    const {
      hap: { Characteristic, Service }
    } = this.platform.api;

    const infoService = new Service.AccessoryInformation();
    infoService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model);

    // store the infoService in the Accessory instance
    this.infoService = infoService;
  }

  identify(callback) {
    callback();
  }
}
