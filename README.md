# Secure Project Access Test

Secure Project Access Test is a simple Playwright-based project for validating project-sharing authorization. It uses PM and teammate accounts to show who can share projects, who can only view shared work, and who is blocked from accessing another PM's private project.

## Test Scenarios

The project displays and tests these scenarios:

- PM1 and PM2 can log in and share their own projects with teammates.
- Teammates can see project invites and eligible projects.
- Teammates see a warning if they try to share projects they do not own.
- PM2 cannot directly access PM1's private project.

## Test Accounts

All accounts use the same password:

```text
123456
```

Available users:

- `PM1@elchai.com`
- `PM2@elchai.com`
- `teammate1@elchai.com`
- `teammate2@elchai.com`

## Tech Stack

- Node.js
- Playwright Test
- JavaScript
- Minimal Node HTTP server

## Prerequisites

Install these before running the project:

- Node.js 18 or newer
- npm
- Visual Studio Code

## Installation

Clone the repository, then install dependencies:

```bash
npm install
```

Install the Playwright browser:

```bash
npx playwright install chromium
```

## Run the App

Start the demo application:

```bash
npm start
```

Open the app in your browser:

```text
http://127.0.0.1:3000
```

## Run the Test

Run the Playwright security test:

```bash
npm test
```

Run the test in headed mode:

```bash
npm run test:headed
```

View the Playwright HTML report:

```bash
npm run report
```

## Project Structure

```text
.
├── docs/
│   └── SECURITY_TEST_SUBMISSION.md
├── src/
│   └── server.js
├── tests/
│   └── security/
│       └── project-sharing.spec.js
├── .gitignore
├── package.json
├── playwright.config.js
├── README.md
└── render.yaml
```

## Deployment

This project is ready to deploy on Render.
https://secure-project-access-test-1.onrender.com/
Recommended Render settings:

```text
Runtime: Node
Build command: npm install
Start command: npm start
Health check path: /health
```

The included `render.yaml` can also be used as a Render Blueprint.

## Submission Note

The main submission document is available at:

```text
docs/SECURITY_TEST_SUBMISSION.md
```

It includes the test scenarios, prerequisites, project structure, and runnable Playwright tests.
