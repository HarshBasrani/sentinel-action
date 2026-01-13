import * as core from '@actions/core';
import * as github from '@actions/github';

export async function postComment(ghosts: string[]) {
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

  if (!prNumber) return;

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
  } catch (error) {
    core.warning(`Failed to post PR comment: ${error}`);
  }
}
