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
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const ghost_imports_1 = require("./ghost-imports");
async function run() {
    try {
        // 1. ENVIRONMENT SETUP
        // GITHUB_WORKSPACE is where the code lives on the runner.
        const projectRoot = process.env.GITHUB_WORKSPACE || '.';
        // 2. INPUT PARSING (Crucial for UX)
        // Users often type "react, react-dom" with spaces. We must sanitize.
        const ignoreInput = core.getInput('ignore_packages');
        const ignoreList = ignoreInput
            ? ignoreInput.split(',').map(s => s.trim()).filter(s => s.length > 0)
            : [];
        const tsConfigPath = core.getInput('tsconfig_path') || 'tsconfig.json';
        const sourceGlobsInput = core.getInput('source_globs');
        const sourceGlobs = sourceGlobsInput
            ? sourceGlobsInput.split(',').map(s => s.trim()).filter(s => s.length > 0)
            : ['src/**/*.{ts,tsx,js,jsx}']; // Default fallback if empty
        core.info('🛡️ Sentinel: Initializing Ghost Scan...');
        core.info(`   - Root: ${projectRoot}`);
        core.info(`   - Ignore List: [${ignoreList.join(', ')}]`);
        core.info(`   - TS Config: ${tsConfigPath}`);
        // 3. EXECUTE LOGIC
        const result = await (0, ghost_imports_1.checkGhostImports)(projectRoot, ignoreList, tsConfigPath, sourceGlobs);
        // 4. REPORTING
        core.info('--------------------------------------------------');
        core.info(`📊 Scan Complete:`);
        core.info(`   - Scanned Files: ${result.scannedFiles}`);
        core.info(`   - Production Deps: ${result.totalDeps}`);
        core.info(`   - Verified Usage: ${result.usedDeps}`);
        core.info('--------------------------------------------------');
        // 5. THE VERDICT (Green or Red)
        if (result.ghosts.length > 0) {
            // This is the most important line. It breaks the build.
            core.setFailed(`
        ❌ Sentinel found ${result.ghosts.length} Ghost Dependencies!
        
        These packages are defined in 'dependencies' but NOT imported in your source code.
        This increases bloat and security risk.
        
        👻 Ghost Packages:
        ${result.ghosts.map(g => `   - ${g}`).join('\n')}
        
        👉 ACTION REQUIRED:
        1. Remove these packages from package.json if unused.
        2. OR move them to 'devDependencies' if they are build tools.
        3. OR add them to 'ignore_packages' in workflow if they are side-effects.
      `);
        }
        else {
            core.info('✅ Sentinel Passed: Dependency graph is clean.');
        }
    }
    catch (error) {
        // Defensive coding: If the tool crashes, fail the build so the user knows.
        if (error instanceof Error)
            core.setFailed(`Sentinel Internal Error: ${error.message}`);
    }
}
run();
//# sourceMappingURL=main.js.map