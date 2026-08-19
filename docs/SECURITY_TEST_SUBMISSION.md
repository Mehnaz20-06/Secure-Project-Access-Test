# Security Test Submission — Secure Project Access

## What this project demonstrates

A minimal Node.js app (no framework) with cookie-based login for four demo
accounts, two role-based dashboards, a project-sharing action restricted to
project managers, and a server-side authorization check that returns
`403 Access denied` for anyone without access to a project.

## Accounts

All accounts use the password `123456`:

| Email | Role |
|---|---|
| PM1@elchai.com | Project Manager |
| PM2@elchai.com | Project Manager |
| teammate1@elchai.com | Teammate |
| teammate2@elchai.com | Teammate |

## Dashboards

**PM dashboard** (shown after PM1 or PM2 logs in):
- **Part 1 — Company Projects**: every project in the company.
- **Part 2 — Eligible Projects**: projects this PM owns or has been granted access to.
- **Share** control at the bottom, active only for PMs, and only for projects they own.

**Teammate dashboard** (shown after teammate1 or teammate2 logs in):
- **Part 1 — Project Invites**: notifications generated when a PM shares a project with them.
- **Part 2 — Eligible Projects**: projects that have been shared with them.
- A **Share** control is shown but disabled — sharing is a PM-only action, and the API enforces this server-side even if the button were bypassed.

## Test scenarios (`tests/security/project-sharing.spec.js`)

1. PM1 logs in and sees both dashboard partitions with an active Share control.
2. Teammate1 logs in and sees both dashboard partitions with Share disabled.
3. **Negative** — PM2 is denied direct access to PM1's project (`p1`): `403 Access denied`.
4. **Negative** — a teammate is denied direct access to a project not shared with them: `403 Access denied`.
5. **Negative** — a teammate calling the share API directly gets `403 Only project managers can share projects`.
6. **Negative** — PM2 cannot share PM1's project: `403 You can only share projects you own`.
7. **Positive** — PM1 shares Project Apollo with teammate1; teammate1 then sees the invite, sees the project under Eligible Projects, and can open it directly (`200 OK`).

## Project structure

```text
.
├── docs/
│   └── SECURITY_TEST_SUBMISSION.md
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── src/
│   └── server.js
├── tests/
│   └── security/
│       └── project-sharing.spec.js
├── .gitignore
├── LICENSE
├── package.json
├── package-lock.json
├── playwright.config.js
├── README.md
└── render.yaml
```

## Running locally

```bash
npm install
npx playwright install chromium
npm start        # serves the app at http://127.0.0.1:3000
```

In a second terminal:

```bash
npm test          # runs the Playwright suite (starts the server itself)
npm run test:headed
npm run report
```

## Deploying (Render)

`render.yaml` is already configured as a Render Blueprint:

```yaml
services:
  - type: web
    name: playwright-security-negative-test
    runtime: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
```

Steps:
1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** and point it at the repo — Render will read `render.yaml` automatically.
3. Alternatively, create a **New → Web Service** manually with build command `npm install`, start command `npm start`, and health check path `/health`.
4. Once deployed, the same four demo accounts work at the live URL.

## Notes

- Data (users, projects, invites) is held in memory and resets whenever the server restarts.
- A `/api/__reset` endpoint is provided purely so the test suite can start from a clean state before each test; it is not linked from the UI.
