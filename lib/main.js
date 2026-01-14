"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const axios_1 = __importDefault(require("axios"));
const ghost_imports_1 = require("./ghost-imports");
const reporter_1 = require("./reporter"); // Import the new reporter
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
        const result = await (0, ghost_imports_1.checkGhostImports)(projectRoot, ignoreList, tsConfigPath, sourceGlobs);
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
                await axios_1.default.post(dashboardUrl, payload, config);
                core.info('✅ Report saved to Dashboard successfully.');
            }
            catch (error) {
                // Don't fail the build just because the dashboard is down
                core.warning(`⚠️ Failed to send report: ${error.message}`);
                if (error.response) {
                    core.debug(JSON.stringify(error.response.data));
                }
            }
        }
        else {
            core.info('ℹ️ Dashboard reporting skipped (url or token missing).');
        }
        // --- NEW: REPORTING LOGIC END ---
        // VERDICT
        if (result.ghosts.length > 0) {
            // 1. Post the Comment (NEW STEP)
            await (0, reporter_1.postComment)(result.ghosts);
            // 2. Fail the Build
            core.setFailed(`
        ❌ Sentinel found ${result.ghosts.length} Ghost Dependencies!
        👻 Ghost Packages: ${result.ghosts.join(', ')}
      `);
        }
        else {
            core.info('✅ Sentinel Passed: Dependency graph is clean.');
        }
    }
    catch (error) {
        if (error instanceof Error)
            core.setFailed(`Sentinel Internal Error: ${error.message}`);
    }
}
run();
//# sourceMappingURL=main.js.map