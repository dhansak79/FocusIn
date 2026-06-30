import { spawnSync } from 'child_process';

export class RunScript {
  constructor(scriptPath, args) {
    this.scriptPath = scriptPath;
    this.args = args;
  }

  static atPath(scriptPath, args = []) {
    return new RunScript(scriptPath, args);
  }

  performAs(world) {
    const result = spawnSync('node', [this.scriptPath, ...this.args], { encoding: 'utf8' });
    world.scriptResult = {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }
}
