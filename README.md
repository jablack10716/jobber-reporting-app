# Jobber Reporting App

A full-stack web application for generating detailed reports from Jobber data, leveraging Jobber's official integration tools and best development practices.

> NOTE (2025-09-18): Profit and margin calculations now use actual invoice-derived revenue (sum of adjusted line item quantities * unit prices). The legacy static BILLABLE_RATE benchmark has been deprecated and removed from configuration. Realized hourly rate is computed per month as (actual revenue / invoiced hours).

> DATA MODE VISIBILITY (2025-09-18): The UI now displays a red MOCK DATA watermark & badge whenever mock data is being served. Reasons include configuration (`USE_REAL_DATA=false`), OAuth authentication failure (expired / invalid tokens), or frontend offline fallback. Real mode hides the watermark entirely.

## Project Overview

This application consists of:
- **Backend**: Ruby on Rails API with OAuth authentication, GraphQL integration for Jobber data, asynchronous report generation, and RESTful endpoints.
- **Frontend**: React application using Jobber's Atlantis Design System for UI components, with responsive design and accessibility.

## Features

- Secure OAuth authentication with Jobber's Developer Center
- GraphQL API integration for fetching clients, jobs, and custom data
- Asynchronous report generation with real-time status updates
- RESTful API endpoints for report management
- Responsive frontend with Atlantis Design System
- User-friendly report selection, generation, and download interface
- Comprehensive error handling and logging
- Real vs Mock data mode watermark & header badge indicating provenance
- Security best practices (CSRF, XSS prevention, secure headers)

## Tech Stack

- **Backend**: Ruby on Rails 6+, PostgreSQL, Redis, Sidekiq
- **Frontend**: React 16+, TypeScript, Atlantis Design System
- **Deployment**: Docker, Heroku/AWS/DigitalOcean
- **Development**: Git, RSpec, Jest, ESLint, Prettier

## Prerequisites

### Windows Setup

1. **Ruby Installation**:
   - Download Ruby+Devkit from https://rubyinstaller.org/
   - Install Ruby 2.7+ (choose the version with Devkit)
   - During installation, select "Add Ruby to PATH"
   - Open PowerShell and verify: `ruby -v`

2. **Node.js Installation**:
   - Download from https://nodejs.org/en/download/
   - Install Node 16+ (LTS version)
   - Or use nvm-windows: https://github.com/coreybutler/nvm-windows
   - Verify: `node -v` and `npm -v`

3. **PostgreSQL**:
   - Download from https://www.postgresql.org/download/windows/
   - Install PostgreSQL 12+
   - Note the password for the postgres user
   - Or use Docker: `docker run --name postgres -e POSTGRES_PASSWORD=password -d -p 5432:5432 postgres`

4. **Redis**:
   - Download from https://redis.io/download
   - Or use Docker: `docker run --name redis -d -p 6379:6379 redis`

5. **Git**:
   - Download from https://git-scm.com/download/win
   - Verify: `git --version`

### macOS/Linux Setup

Use RVM for Ruby:
```bash
curl -sSL https://get.rvm.io | bash
rvm install 2.7
rvm use 2.7
```

Use nvm for Node:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 16
nvm use 16
```

Install PostgreSQL and Redis via package manager or Docker.

## Setup Instructions

1. **Clone the repositories** (already done):
   - Backend: `backend/` folder
   - Frontend: `frontend/` folder

2. **Backend Setup**:
   ```bash
   cd backend
   # Install Ruby dependencies
   bundle install
   # Copy environment file
   cp .env.sample .env
   # Edit .env with your values (see below)
   # Setup database
   rails db:create
   rails db:migrate
   # Start Redis (if not using Docker)
   redis-server
   # Start Sidekiq
   bundle exec sidekiq
   # Start Rails server
   rails s -p 4000
   ```

3. **Frontend Setup**:
   ```bash
   cd frontend
   # Install Node dependencies
   npm install
   # Copy environment file
   cp .env.sample .env
   # Edit .env with your values (see below)
   # Start development server
   npm start
   ```

## Environment Configuration

### Backend (.env)
```bash
JOBBER_CLIENT_ID=your_client_id_from_jobber_dev_center
JOBBER_CLIENT_SECRET=your_client_secret_from_jobber_dev_center
JOBBER_API_URL=https://api.getjobber.com/api
CLIENT_APP_ORIGIN=http://localhost:3000
REDIS_URL=redis://localhost:6379/1
SIDEKIQ_REDIS_URL=redis://localhost:6379/1
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_postgres_password
SECRET_KEY_BASE=generate_with_rails_secret
```

### Frontend (.env)
```bash
REACT_APP_API_URL=http://localhost:4000/
REACT_APP_JOBBER_API_URL=https://api.getjobber.com/api/oauth/authorize
REACT_APP_JOBBER_APP_CLIENT_ID=your_client_id
REACT_APP_REDIRECT_URL=http://localhost:3000/auth
```

## Jobber Developer Center Setup

1. Go to https://developer.getjobber.com/
2. Create a new app
3. Set redirect URI to `http://localhost:3000/auth` (for development)
4. Copy Client ID and Client Secret to your .env files

## Development Workflow

### Backend
- Use `rails c` for console
- Run tests: `rspec`
- Lint: `rubocop`

### Frontend
- Run tests: `npm test`
- Lint: `npm run lint`
- Format: `npm run format`

## Deployment

### Docker
```bash
# Build and run with Docker Compose
docker-compose up --build
```

### Heroku
- Backend: Follow Heroku Rails deployment guide
- Frontend: Use Heroku buildpack for Create React App

## Project Structure

```
jobber-reporting-app/
├── backend/          # Rails API
│   ├── app/
│   ├── config/
│   ├── db/
│   └── ...
├── frontend/         # React App
│   ├── src/
│   ├── public/
│   └── ...
├── .gitignore
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Run tests
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support


## Plumber Reporting API Usage

### REST Endpoint

The backend exposes a production-ready REST endpoint for plumber performance reports:

```
GET http://localhost:3000/api/reports/plumber?name=Lorin
```

**Query Parameters:**
- `name` (required): The plumber's first or full name (e.g., `Lorin`, `Wes`, `Elijah`)

**Sample Response:**
```json
{
   "success": true,
   "plumber": {
      "id": "Z2lkOi8vSm9iYmVyL1VzZXIvMTI1MjI1Mw==",
      "name": "Lorin Sharpless",
      "email": "lorin.sharpless@company.com"
   },
   "period": "2025-09",
   "metrics": {
      "jobsCompleted": 18,
      "totalRevenue": 7245.50,
      "averageJobValue": 402.53,
      "customerSatisfaction": 4.7,
      "hoursWorked": 156,
      "averageJobTime": 8.7,
      "completionRate": 94.2
   },
   "recentJobs": [
      { "jobNumber": "J-2025-001", "client": "ServiceMaster", "value": 485.00, "status": "completed" },
      { "jobNumber": "J-2025-002", "client": "Lynai Foreman", "value": 325.00, "status": "completed" },
      { "jobNumber": "J-2025-003", "client": "Servpro", "value": 750.00, "status": "in_progress" }
   ],
   "lastUpdated": "2025-09-14T22:17:24.888Z"
}
```

### Frontend Integration

- The React frontend (`frontend/src/pages/Reports/PlumberReport.tsx`) fetches data from this endpoint using the configured `REACT_APP_API_URL` (default: `http://localhost:3000`).
- To view a plumber's report, navigate to `/reports/lorin`, `/reports/wes`, or `/reports/elijah` in the app UI.
- The UI displays metrics, charts, and recent jobs using the live API data.

---

## Node Server (Mock API) Quick Start & Troubleshooting

For the lightweight Node server that serves the built React frontend plus mock plumber reporting endpoints (file: `backend/server.js`):

### One‑time build & serve flow
1. From `frontend/`: run `npm install` (first time) then `npm run build`.
2. Copy (or rebuild) assets into `backend/build` (current workflow already places build there if run inside backend).
3. From repo root (or `backend/`): run `node backend/server.js`.
4. Visit http://localhost:3000.

### Hot iteration (recommended)
During active UI work prefer CRA dev server on a different port (e.g. 3001) and point API calls at `http://localhost:3000` for mock data. When ready for an integrated test, rebuild and restart Node server.

### Avoiding stale bundles
If chart labels or UI changes do not appear:
- Force a hard reload (Ctrl+Shift+R).
- Confirm hash changes in `backend/build/static/js/main.*.js` after `npm run build`.
- Delete old build: `Remove-Item -Recurse -Force backend/build` (PowerShell) then copy fresh build.

### Unexpected immediate exit (exit code 1)
Symptoms: Task panel shows the server starts, logs initial lines, then terminates with code 1 and no visible stack trace.

Diagnostic steps:
1. Check / create log: `backend/server-error.log` (enhanced diagnostics append lines with prefixes `UNCAUGHT_EXCEPTION`, `UNHANDLED_REJECTION`, `exit code=`).
2. Run with heartbeat: set `ENABLE_HEARTBEAT=1` in `.env` to emit a minute heartbeat for liveness.
3. Separate kill/start: Do NOT chain `Stop-Process` and `node` in one line; race conditions can deliver spurious signals.
4. Port conflict: Ensure nothing else is bound to 3000 (`netstat -ano | findstr :3000`). If another PID appears, terminate that process first.
5. Inspector mode: `node --inspect backend/server.js` to capture uncaught exceptions in DevTools.
6. Verbose env: add `DEBUG=express:*` (Unix) or `$env:DEBUG='express:*'` (PowerShell) before starting to trace route handling.

### Resilient development loop
Use `backend/run-loop.ps1` for auto‑restart; stops on double Ctrl+C or creating `backend/stop-loop.txt`.

### Common causes catalog
| Cause | Indicator | Mitigation |
|-------|-----------|-----------|
| Rapid manual restarts sending multiple SIGINT | Multiple start banners then exit | Separate kill/start commands, use run loop |
| Port still in TIME_WAIT / occupied | EADDRINUSE if stack trace appears (may be swallowed) | Wait a few seconds; free port or change port env |
| Uncaught sync error in module init | Early exit before first HTTP request | Check `server-error.log` earliest lines |
| Stale build assets referencing removed code | 404s / runtime errors in browser console | Rebuild, clear cache |

### Adding more diagnostics
`server.js` now logs lifecycle hooks: `beforeExit`, `exit`, optional heartbeat. Extend by adding additional `diagnostic()` calls around suspect code blocks.

### When reporting an issue
Include: Node version (`node -v`), last 30 lines of `server-error.log`, whether heartbeat reached, and steps to reproduce (build vs dev).


For issues or questions, please refer to:
- Jobber Developer Docs: https://developer.getjobber.com/docs
- Rails API Template: https://github.com/GetJobber/Jobber-AppTemplate-RailsAPI
- React Template: https://github.com/GetJobber/Jobber-AppTemplate-React
