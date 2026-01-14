import * as core from '@actions/core';
import * as github from '@actions/github';
import axios from 'axios';
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

    // --- NEW: REPORTING LOGIC START ---
    const dashboardUrl = core.getInput('dashboard_url');
    const projectToken = core.getInput('project_token');

    if (dashboardUrl && projectToken) {
      core.info(`📡 Sending report to Sentinel Dashboard: ${dashboardUrl}`);

      const payload = {
        repo_token: projectToken,
        // Calculate a simple score: 100 - (5 points per unused dep)
        health_score: Math.max(0, 100 - (result.ghosts.length * 5)),
        ghost_dependencies: result.ghosts,
        commit_hash: github.context.sha,
        branch: github.context.ref.replace('refs/heads/', ''),
      };

      try {
        // --- FIX: Add Header to bypass Localtunnel warning page ---
        const config = {
          headers: {
            'Bypass-Tunnel-Reminder': 'true',
            'Content-Type': 'application/json'
          }
        };
        
        await axios.post(dashboardUrl, payload, config);
        core.info('✅ Report saved to Dashboard successfully.');
      } catch (error: any) {
        // Don't fail the build just because the dashboard is down
        core.warning(`⚠️ Failed to send report: ${error.message}`);
        if (error.response) {
          core.debug(JSON.stringify(error.response.data));
        }
      }
    } else {
      core.info('ℹ️ Dashboard reporting skipped (url or token missing).');
    }
    // --- NEW: REPORTING LOGIC END ---

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
