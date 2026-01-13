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
exports.checkGhostImports = checkGhostImports;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ts_morph_1 = require("ts-morph");
const core = __importStar(require("@actions/core"));
async function checkGhostImports(projectRoot, ignoreList, tsConfigPath, sourceGlobs) {
    // 1. FAIL FAST: Check if package.json exists
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        throw new Error(`No package.json found at ${packageJsonPath}. Sentinel requires a root package.json.`);
    }
    // 2. LOAD DEPS: Only scan "dependencies" (Production), ignore "devDependencies"
    // Read raw content
    const raw = fs.readFileSync(packageJsonPath, 'utf-8');
    // Strip BOM (Byte Order Mark) if present - fixes Windows/PowerShell issues
    const cleanRaw = raw.replace(/^\uFEFF/, '');
    const pkg = JSON.parse(cleanRaw);
    const dependencies = Object.keys(pkg.dependencies || {});
    if (dependencies.length === 0) {
        return { ghosts: [], totalDeps: 0, usedDeps: 0, scannedFiles: 0 };
    }
    // 3. SETUP PARSER: Initialize ts-morph
    const fullTsConfigPath = path.join(projectRoot, tsConfigPath);
    let project;
    // Stability Check: If tsconfig is missing, don't crash. Fallback to basic mode.
    if (fs.existsSync(fullTsConfigPath)) {
        core.info(`Using tsconfig at: ${fullTsConfigPath}`);
        project = new ts_morph_1.Project({
            tsConfigFilePath: fullTsConfigPath,
            skipAddingFilesFromTsConfig: false,
        });
    }
    else {
        core.warning(`tsconfig.json not found at ${fullTsConfigPath}. Falling back to file globs.`);
        project = new ts_morph_1.Project({});
    }
    // 4. LOAD FILES: Explicitly add files based on user input (Safety Rail)
    if (sourceGlobs.length > 0) {
        const globPaths = sourceGlobs.map(g => path.join(projectRoot, g));
        project.addSourceFilesAtPaths(globPaths);
    }
    const sourceFiles = project.getSourceFiles();
    core.info(`Scanning ${sourceFiles.length} source files for imports...`);
    if (sourceFiles.length === 0) {
        core.warning("No source files found! Check your 'source_globs' input.");
        return { ghosts: [], totalDeps: dependencies.length, usedDeps: 0, scannedFiles: 0 };
    }
    const usedPackages = new Set();
    // 5. THE SCAN: Iterate over every file to find imports
    for (const sourceFile of sourceFiles) {
        try {
            // A. Standard Imports: import { x } from 'lodash'
            sourceFile.getImportDeclarations().forEach(imp => {
                usedPackages.add(extractPackageName(imp.getModuleSpecifierValue()));
            });
            // B. Export Declarations: export { x } from 'lodash'
            sourceFile.getExportDeclarations().forEach(exp => {
                const val = exp.getModuleSpecifierValue();
                if (val)
                    usedPackages.add(extractPackageName(val));
            });
            // C. Dynamic Imports & Requires: require('lodash') or import('lodash')
            sourceFile.getDescendantsOfKind(ts_morph_1.SyntaxKind.CallExpression).forEach(call => {
                const expr = call.getExpression().getText();
                if (expr === 'require' || expr === 'import') {
                    const args = call.getArguments();
                    // We only catch string literals. Variables (require(someVar)) are ignored intentionally.
                    if (args.length > 0 && args[0].getKind() === ts_morph_1.SyntaxKind.StringLiteral) {
                        const moduleName = args[0].getText().replace(/['"`]/g, '');
                        usedPackages.add(extractPackageName(moduleName));
                    }
                }
            });
        }
        catch (err) {
            // Defensive: One bad file shouldn't crash the whole pipeline
            core.debug(`Failed to parse file ${sourceFile.getFilePath()}: ${err}`);
        }
    }
    // 6. CALCULATE GHOSTS
    const ghosts = dependencies.filter(dep => {
        if (usedPackages.has(dep))
            return false; // Used? Keep it.
        if (ignoreList.includes(dep))
            return false; // Whitelisted? Keep it.
        if (dep.startsWith('@types/'))
            return false; // Type definition? Keep it.
        return true; // Unused + Not Ignored = GHOST
    });
    return {
        ghosts,
        totalDeps: dependencies.length,
        usedDeps: dependencies.length - ghosts.length,
        scannedFiles: sourceFiles.length
    };
}
// Helper: Extracts "lodash" from "lodash/fp" or "@org/pkg" from "@org/pkg/sub"
function extractPackageName(importPath) {
    if (importPath.startsWith('@')) {
        const parts = importPath.split('/');
        return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : importPath;
    }
    return importPath.split('/')[0];
}
//# sourceMappingURL=ghost-imports.js.map