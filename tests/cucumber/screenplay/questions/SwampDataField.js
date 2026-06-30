export class SwampDataField {
  constructor(dotPath) {
    this.dotPath = dotPath;
  }

  static at(dotPath) {
    return new SwampDataField(dotPath);
  }

  answeredBy(world) {
    if (!world.swampData) throw new Error('No swamp data has been queried yet');
    return this.dotPath.split('.').reduce((obj, key) => obj?.[key], world.swampData);
  }
}
