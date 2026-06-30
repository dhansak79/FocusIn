export class StorageWrites {
  constructor(key) {
    this.key = key;
  }

  static forKey(key) {
    return new StorageWrites(key);
  }

  answeredBy(world) {
    for (let i = world.storageSets.length - 1; i >= 0; i--) {
      if (Object.prototype.hasOwnProperty.call(world.storageSets[i], this.key)) {
        return world.storageSets[i][this.key];
      }
    }
    return undefined;
  }
}
