import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { checkGhostImports } from '../src/ghost-imports';

describe('Sentinel Ghost Killer Integration', () => {
  let tempDir: string;

  // SETUP: Create a fresh temp folder before every test
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-test-'));
  });

  // TEARDOWN: Delete the temp folder so we don't leave trash
  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('Should detect a Ghost Dependency (unused)', async () => {
    // 1. Create package.json with 'lodash'
    const pkg = {
      dependencies: {
        'lodash': '^4.17.21'
      }
    };
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(pkg));

    // 2. Create a source file that DOES NOT import lodash
    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(srcDir, 'index.ts'), 'console.log("No imports here");');

    // 3. Create dummy tsconfig
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');

    // 4. Run the scanner
    const result = await checkGhostImports(tempDir, [], 'tsconfig.json', ['src/**/*.ts']);

    // 5. Assert: 'lodash' should be caught
    expect(result.ghosts).toContain('lodash');
    expect(result.totalDeps).toBe(1);
    expect(result.usedDeps).toBe(0);
  });

  test('Should ignore a Used Dependency', async () => {
    // 1. Create package.json with 'axios'
    const pkg = {
      dependencies: {
        'axios': '^1.0.0'
      }
    };
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(pkg));

    // 2. Create source file that IMPORTS axios
    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(srcDir, 'api.ts'), "import axios from 'axios';");

    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');

    // 3. Run the scanner
    const result = await checkGhostImports(tempDir, [], 'tsconfig.json', ['src/**/*.ts']);

    // 4. Assert: No ghosts
    expect(result.ghosts).toHaveLength(0);
    expect(result.usedDeps).toBe(1);
  });
});
