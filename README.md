# Micro Frontend Workspace

**Branches**

| Repo | Branch |
|---|---|
| Main (root workspace — maintains all workspaces via `package.json`) | `feature/mfa-mainbranch` |
| Container | `feature/mfa-container` |
| Workflow | `feature/mfa-workflow` |

## Setup from scratch

```bash
# 1. Check prerequisites
node --version    # 18+
git --version

# 2. Clone the Main branch
git clone -b feature/mfa-mainbranch https://github.com/ramesh123/microfrontend.git microfrontend
cd microfrontend

# 3. Pull in the submodules (container, workflow), checked out on their own tracked branches
git submodule update --init --recursive

# 4. Check out each submodule's branch explicitly
cd container
git checkout feature/mfa-container
cd ../workflow
git checkout feature/mfa-workflow
cd ..

# 5. (Optional) Enable Corepack
corepack enable

# 6. Import the workspace-tools plugin (needed for `workspaces foreach` on Yarn 3.x)
corepack yarn plugin import @yarnpkg/plugin-workspace-tools

# 7. Install dependencies for all workspaces (main + container + workflow)
corepack yarn install

# 8. Run the dev servers
npm run dev
# Container -> http://localhost:3000
# Workflow  -> http://localhost:3001

# 9. Build + serve (required to see Module Federation actually working)
npm run build
npm run serve:all
# -> open http://localhost:3000
```

## Pulling updates

```bash
# Main branch (root repo)
git pull origin feature/mfa-mainbranch

# All submodules at once, fast-forwarded to their tracked branches
git submodule update --recursive --remote --init --merge

# Or pull each branch directly
cd container && git pull origin feature/mfa-container && cd ..
cd workflow && git pull origin feature/mfa-workflow && cd ..