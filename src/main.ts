import * as core from '@actions/core';
import { checkGhostImports } from './ghost-imports';
import { postComment } from './reporter'; // Import the new reporter

async function run() {
  try {
    const projectRoot = process.env.GITHUB_WORKSPACE || '.';
    
    // Inputs
    const ignoreInput = core.getInput('ignore_packages');
    const ignoreList = ignoreInput 
      ? ignoreInput.split(',').map(s => s.trim()).filter(s => s.length > 0) 
      : [];

    const tsConfigPath = core.getInput('tsconfig_path') || 'tsconfig.json';
    const sourceGlobsInput = core.getInput('source_globs');
    const sourceGlobs = sourceGlobsInput
      ? sourceGlobsInput.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : ['src/**/*.{ts,tsx,js,jsx}'];

    core.info('🛡️ Sentinel: Initializing Ghost Scan...');

    // Execute Logic
    const result = await checkGhostImports(projectRoot, ignoreList, tsConfigPath, sourceGlobs);

    // Reporting
    core.info('--------------------------------------------------');
    core.info(`📊 Scan Complete:`);
    core.info(`   - Scanned Files: ${result.scannedFiles}`);
    core.info(`   - Production Deps: ${result.totalDeps}`);
    core.info(`   - Verified Usage: ${result.usedDeps}`);
    core.info('--------------------------------------------------');

    // VERDICT
    if (result.ghosts.length > 0) {
      // 1. Post the Comment (NEW STEP)
      await postComment(result.ghosts);

      // 2. Fail the Build
      core.setFailed(`
        ❌ Sentinel found ${result.ghosts.length} Ghost Dependencies!
        👻 Ghost Packages: ${result.ghosts.join(', ')}
      `);
    } else {
      core.info('✅ Sentinel Passed: Dependency graph is clean.');
    }

  } catch (error) {
    if (error instanceof Error) core.setFailed(`Sentinel Internal Error: ${error.message}`);
  }
}

run();
