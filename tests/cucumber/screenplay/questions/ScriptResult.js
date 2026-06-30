export class ScriptResult {
  constructor(field) {
    this.field = field;
  }

  static exitCode() {
    return new ScriptResult('status');
  }

  static stdout() {
    return new ScriptResult('stdout');
  }

  static stderr() {
    return new ScriptResult('stderr');
  }

  answeredBy(world) {
    if (!world.scriptResult) throw new Error('No script has been run yet');
    return world.scriptResult[this.field];
  }
}
