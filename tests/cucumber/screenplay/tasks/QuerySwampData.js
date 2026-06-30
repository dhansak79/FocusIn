import { execSync } from 'child_process';

export class QuerySwampData {
  constructor(name, spec) {
    this.name = name;
    this.spec = spec;
  }

  static forModel(name, spec = 'current') {
    return new QuerySwampData(name, spec);
  }

  performAs(world) {
    const output = execSync(
      `~/.swamp/bin/swamp data get ${this.name} ${this.spec} --json`,
      { encoding: 'utf8' },
    );
    world.swampData = JSON.parse(output);
  }
}
