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
exports.postComment = postComment;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
async function postComment(ghosts) {
    // 1. Safety Check: Only run on PRs
    if (github.context.eventName !== 'pull_request') {
        core.info('Not a Pull Request. Skipping comment creation.');
        return;
    }
    // 2. Get the GitHub Token (Provided automatically by Actions)
    const token = core.getInput('github_token');
    if (!token) {
        core.warning('GITHUB_TOKEN not found. Cannot post PR comment.');
        return;
    }
    const octokit = github.getOctokit(token);
    const context = github.context;
    const prNumber = context.payload.pull_request?.number;
    if (!prNumber)
        return;
    // 3. Construct the Message (Markdown)
    const body = `
### 🚫 Sentinel Policy Violation

**Sentinel** found **${ghosts.length}** unused dependencies in \`package.json\`.
These packages are installed but not imported in your source code.

| Ghost Dependency 👻 | Action Required |
| :--- | :--- |
| ${ghosts.map(g => `\`${g}\``).join('<br>')} | Remove from \`package.json\` |

---
**How to fix?**
1. Run \`npm uninstall <package_name>\`
2. OR, if this is a global side-effect (e.g. polyfill), add it to \`ignore_packages\` in your workflow.
  `;
    try {
        // 4. Post the Comment
        await octokit.rest.issues.createComment({
            ...context.repo,
            issue_number: prNumber,
            body: body,
        });
        core.info(`📝 Posted comment to PR #${prNumber}`);
    }
    catch (error) {
        core.warning(`Failed to post PR comment: ${error}`);
    }
}
//# sourceMappingURL=reporter.js.map