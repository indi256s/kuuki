---
name: cloudflare
description: Generic Cloudflare Pages reference for Wrangler. Kuuki itself deploys to Workers with deploy-kuuki; its Pages project holds the frozen rollback build.
---

# Cloudflare Deployment Skill

This skill provides utilities and documentation for deploying applications to Cloudflare Pages.

## Core Commands

### Authentication

Authenticate the Wrangler CLI with your Cloudflare account.

```bash
npx wrangler login
```

### Pages Deployment

Deploy a directory of static assets to Cloudflare Pages.

**Command Syntax:**

```bash
npx wrangler pages deploy [DIRECTORY] --project-name [PROJECT_NAME]
```

**Example:**

```bash
# Deploy the 'dist' folder to the 'kuuki' project
npx wrangler pages deploy dist --project-name=kuuki
```

## Troubleshooting & Verification

- **Check Login Status**: Run `npx wrangler whoami` to see the currently authenticated user.
- **Project Name Consistency**: Ensure the `--project-name` matches exactly what is configured in your Cloudflare dashboard.
- **Asset Directory**: Verify that the directory you are deploying (e.g., `dist` or `build`) exists and contains the correct build artifacts.
- **CI/CD Integration**: For automated deployments, strict usage of `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets is required in your workflow environment.

## Workflow Example (GitHub Actions)

Kuuki's CI no longer deploys. Deploy Kuuki with `docs/skills/deploy-kuuki/SKILL.md`.

```yaml
- uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    command: pages deploy apps/web/dist --project-name=kuuki
```
