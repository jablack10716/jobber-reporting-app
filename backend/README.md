## Troubleshooting Backend Server Hangs or Immediate Exit

If the backend server hangs or exits immediately (exit code 1) with no visible error:

1. **Check server-error.log**: Review `backend/server-error.log` for any `UNCAUGHT_EXCEPTION`, `UNHANDLED_REJECTION`, or early exit messages.
2. **Run with trace warnings**: Use `node --trace-warnings server.js` in the backend directory to capture hidden errors or warnings.
3. **Inspector mode**: Run `node --inspect server.js` and connect a debugger (e.g., Chrome DevTools) to catch uncaught exceptions.
4. **Port conflicts**: Ensure port 3000 is free: `netstat -ano | findstr :3000`. Terminate any process using the port before restarting.
5. **Separate kill/start**: Always stop Node processes before starting a new one. Do not chain `Stop-Process` and `node` in a single command.
6. **Check .env and tokens.json**: Ensure all required environment variables and tokens are present and valid. Refer to Jobber Developer Docs for required fields and scopes.
7. **Verbose logging**: Set `DEBUG=express:*` (Unix) or `$env:DEBUG='express:*'` (PowerShell) for more detailed route and middleware logs.

If the above steps do not resolve the issue, document the Node version, last 30 lines of `server-error.log`, and any output from `node --trace-warnings server.js` when seeking help.

# Jobber App Template - Rails API

[![CircleCI](https://circleci.com/gh/GetJobber/Jobber-AppTemplate-RailsAPI/tree/main.svg?style=svg&circle-token=6b380bcc34004fc33fd7d0a8041ef80e20fe522d)](https://circleci.com/gh/GetJobber/Jobber-AppTemplate-RailsAPI/tree/main)

The primary objective of this Ruby on Rails API template is to provide a starting point to integrate your app with [Jobber](https://getjobber.com).

## Table of contents

- [What is this App for?](#what-is-this-app-for)
- [OAuth flow](#oauth-flow)
- [How it works](#how-it-works)
  - [Forming a GraphQL Query](#forming-a-graphql-query)
  - [Making a Query request](#making-a-query-request)
  - [Putting it all together](#putting-it-all-together)
  - [Expected result](#expected-result)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
  - [Running the app](#running-the-app)
- [Making GraphQL requests](#making-graphql-requests)
- [Deployment](#deployment)
  - [Deploying with Heroku](#deploying-with-heroku)
- [Learn More](#learn-more)
- [Need help of have an idea?](#need-help-or-have-an-idea)
- [License](#license)

## What is this APP for?

This Ruby on Rails API Template is meant to be a quick and easy way to get you up to speed using Jobber's GraphQL API. This API is to be consumed by the [React App Template](https://github.com/GetJobber/Jobber-AppTemplate-React) and handles authentication through Jobber's Developer Center and a few GraphQL example queries.

## OAuth flow

The authentication flow is done by both apps, the frontend is responsable to receive the `code` returned from Jobber's GraphQL API once the users goes through the oauth and allow the app to connect to they jobber account.

On this App you will find a `/request_access_token` endpoint that will authenticate the user upon recieving a valid code, creating a record for a JobberAccount, generating an HttpOnly Cookie and sending it to the frontend in order to mantain the session.

> Note: An App needs to be created on Jobber's Developer Center, and the environment variables described in `.env.sample` need to be configured in order to make the oauth redirection.
When you run both apps together, you should see a list of the clients from your Jobber account on the frontend:

### Forming a GraphQL Query


Read more on [Jobber's API Rate Limits](https://developer.getjobber.com/docs/build_with_jobber/api_rate_limits).

module Graphql

      def variables
        {
          limit: CLIENTS_LIMIT,
          cursor: nil,
          filter: nil,
        }
      end

      ClientsQuery = JobberAppTemplateRailsApi::Client.parse(<<~'GRAPHQL')
        fragment PageInfoFragment on PageInfo {
          endCursor
          hasNextPage
        }
        query(
          $limit: Int,
          $cursor: String,
          $filter: ClientFilterAttributes,
        ) {
          clients(first: $limit, after: $cursor, filter: $filter) {
            nodes {
              id
              name
            }
            pageInfo {
              ...PageInfoFragment
            }
          }
        }
      GRAPHQL
    end
  end
end
```

### Making a Query request

We use `execute_query` to make a simple request and make sure it won't cause any issues with `result_has_errors?` and `sleep_before_throttling`.

`execute_paginated_query` is a recursive method that will call `execute_query` until `has_next_page` is false, meaning we've reached the end of our query. This is where the `CLIENTS_LIMIT` constant in the ClientsQuery comes into play.

If for any reason the query returns an error, it will be raised by `result_has_errors?`.

Finally, `sleep_before_throttling` makes sure your query won't go over the [Maximum Available Limit](https://developer.getjobber.com/docs/build_with_jobber/api_rate_limits#maximumavailable) by taking the cost of the previous request as the `expected_cost` of the next request and comparing it against the currently available points.

```ruby
# app/services/jobber_service.rb
class JobberService

  def execute_query(token, query, variables = {}, expected_cost: nil)
    context = { Authorization: "Bearer #{token}" }
    result = JobberAppTemplateRailsApi::Client.query(query, variables: variables, context: context)
    result = result.original_hash

    result_has_errors?(result)
    sleep_before_throttling(result, expected_cost)
    result
  end

  def execute_paginated_query(token, query, variables, resource_names, paginated_results = [], expected_cost: nil)
    result = execute_query(token, query, variables, expected_cost: expected_cost)

    result = result["data"]

    resource_names.each do |resource|
      result = result[resource].deep_dup
    end

    paginated_results << result["nodes"]
    page_info = result["pageInfo"]
    has_next_page = page_info["hasNextPage"]

    if has_next_page

    paginated_results.flatten
    raise Exceptions::GraphQLQueryError, result["errors"].first["message"]
  end

  def sleep_before_throttling(result, expected_cost = nil)
    max_available = throttle_status["maximumAvailable"].to_i
    restore_rate = throttle_status["restoreRate"].to_i
    sleep_time = 0

    if expected_cost.blank?
      expected_cost = max_available * 0.6
    end
    if currently_available <= expected_cost
      sleep_time = ((max_available - currently_available) / restore_rate).ceil
      sleep(sleep_time)
    end

    sleep_time
  end
end
```

### Putting it all together

`clients_controller#index` retrieves the account's access token to use as a parameter for the `execute_paginated_query` method along with the `ClientsQuery` and its `variables` and pass `["clients"]` as the `paginated_result` param. We don't pass an expected cost for this example, meaning `sleep_before_throttling` will be our default 60% of the Maximum Available Limit.

```ruby
# app/controllers/clients_controller.rb
class ClientsController < AuthController
  include Graphql::Queries::Clients

  def index
    token = @jobber_account.jobber_access_token
    clients = jobber_service.execute_paginated_query(token, ClientsQuery, variables, ["clients"])

    render(json: { clients: clients }, status: :ok)
  rescue Exceptions::GraphQLQueryError => error
    render(json: { message: "#{error.class}: #{error.message}" }, status: :internal_server_error)
  end
end
```

### Expected result

You should expect `clients_controller#index` to return a json similar to this:

```json
{
  "clients": [
    {
      "id": "ABC1DEFgHIE=",
      "name": "Anakin Skywalker"
    },
    {
      "id": "ABC1DEFgHIY=",
      "name": "Paddy's Pub"
    },
    {
      "id": "ABC1DEFgHIM=",
      "name": "Maximus Decimus Meridius"
    },
    {
      "id": "ABC1DEFgHIM=",
      "name": "Tom Bombadil"
    }
  ]
}
```

Which should look something like this on the frontend:

<img width="1728" alt="Screen Shot 2022-06-22 at 12 56 59" src="https://user-images.githubusercontent.com/804175/175104972-cf59f08d-e40c-441f-be90-cede6e7cceaf.png">

## Getting started

### Prerequisites

- Ruby 3.0.1

  - `rvm install "ruby-3.0.1"`

  - `rvm use "ruby-3.0.1"`

- Postgres database

  This project is configured to use the postgres database from the `docker-compose.yml` file.

  - Install Docker:
    - [Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
    - [MacOS](https://docs.docker.com/desktop/mac/install/)
    - [Desktop](https://docs.docker.com/desktop/windows/install/)

- Jobber App
  - Create a developer account:
    - [https://developer.getjobber.com/](https://developer.getjobber.com/)
  - Create new app:
    - Follow the docs to get started: [https://developer.getjobber.com/docs](https://developer.getjobber.com/docs)
    - Your app must have (as a minimum) read access to *Clients* and *Users* under the Scopes section, in order for this template to work:
      <img width="1728" alt="Screen Shot 2022-06-22 at 13 27 50" src="https://user-images.githubusercontent.com/804175/175111860-ad44f70d-5d33-4334-b5ff-afd677c22a04.png">


### Setup

1. Install gems

   - `bundle install`

2. Create postgres and redis docker container

   - `docker compose up -d`

3. Setup environment variables

   - `cp .env.sample .env`

     Make sure to have the correct env values

4. Create database and migrations

   - `rails db:create`

   - `rails db:migrate`

5. Update the GraphQL schema

   - `rake schema:update`

### Running the app

- `rails s -p 4000`

## Making GraphQL requests

- Learn more about Jobber's GraphQL API:
  - [About Jobber's API](https://developer.getjobber.com/docs/#about-jobbers-api)

## Deployment

This template comes with a `Procfile` configured so you can easily deploy on [Heroku](https://heroku.com), however, you can deploy this API on the platform of your choice.

### Deploying with Heroku

1. Install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli#install-the-heroku-cli).

2. Log in to you Heroku account:

   - `heroku login`

3. Create a new Heroku app, this can be done from your browser or using Heroku's CLI in your terminal:

   - `heroku create <name-of-your-app>`

4. Verify the git remote was added with `git config --list --local | grep heroku` or add the heroku remote yourself:

   - `git remote add heroku <heroku-app-url>`

5. Deploy

   - `git push heroku main`

To learn more about deploying on Heroku:

- [https://devcenter.heroku.com/categories/deployment](https://devcenter.heroku.com/categories/deployment)

## Learn More

Checkout [Jobber's API documentation](https://developer.getjobber.com/docs/) for more details on its setup and usage.

You can learn more about Ruby on Rails API mode in the [documentation](https://guides.rubyonrails.org/api_app.html).

For more information on Heroku, visit the [Heroku Dev Center](https://devcenter.heroku.com/) or the [Getting started on Heroku with Rails 6](https://devcenter.heroku.com/articles/getting-started-with-rails6) for more specific content on Rails.

## Need help or have and idea?

Please follow one of these [issue templates](https://github.com/GetJobber/Jobber-AppTemplate-RailsAPI/issues/new/choose) if you'd like to submit a bug or request a feature.

## Debug

Enable targeted debug logs in the Node backend by setting the JOBBER_DEBUG environment variable. This toggles verbose messages inside `backend/jobber-queries.js` that are useful during data investigation but are disabled by default.

What it enables (when true):
- Invoice processing trace lines (e.g., item matching, filtered items, excavation multipliers)
- Unique lead plumber detection and 50/50 split notes
- Custom field dumps for GraphQL selections
- Critical calculation checkpoints for revenue/hours aggregation

PowerShell examples:
```powershell
# Enable for a single run
$env:JOBBER_DEBUG='true'; node server.js

# Disable afterwards (quiet mode)
Remove-Item Env:JOBBER_DEBUG
```

Notes:
- This flag is separate from diagnostics like `DIAG_INTERVAL_SEC` and `DIAG_REQUEST_LOG` (which control memory/request sampling in `server.js`). You can use them together when needed.
- Keep `JOBBER_DEBUG` off in normal development and production to avoid noisy logs.

## Troubleshooting Backend Server Hangs or Immediate Exit

If the backend server hangs or exits immediately (exit code 1) with no visible error:

1. **Check server-error.log**: Review `backend/server-error.log` for any `UNCAUGHT_EXCEPTION`, `UNHANDLED_REJECTION`, or early exit messages.
2. **Run with trace warnings**: Use `node --trace-warnings server.js` in the backend directory to capture hidden errors or warnings.
3. **Inspector mode**: Run `node --inspect server.js` and connect a debugger (e.g., Chrome DevTools) to catch uncaught exceptions.
4. **Port conflicts**: Ensure port 3000 is free: `netstat -ano | findstr :3000`. Terminate any process using the port before restarting.
5. **Separate kill/start**: Always stop Node processes before starting a new one. Do not chain `Stop-Process` and `node` in a single command.
6. **Check .env and tokens.json**: Ensure all required environment variables and tokens are present and valid. Refer to Jobber Developer Docs for required fields and scopes.
7. **Verbose logging**: Set `DEBUG=express:*` (Unix) or `$env:DEBUG='express:*'` (PowerShell) for more detailed route and middleware logs.

If the above steps do not resolve the issue, document the Node version, last 30 lines of `server-error.log`, and any output from `node --trace-warnings server.js` when seeking help.

### Development Runtime Guard

A lightweight dev guard prevents accidentally running multiple backend instances simultaneously.

Behavior:
- Creates `.server.lock` in `backend/` with current PID and timestamp.
- On startup, if the lock exists and the recorded PID is alive, the new process exits immediately (no error) to avoid port conflicts.
- If the lock is stale (PID not alive), it is reclaimed.

Environment overrides:
- `DISABLE_LOCK=1` Disable the guard entirely (not recommended for normal dev).
- `FORCE_START=1` Ignore an active lock and start anyway (overwrites lock).
- `LOCK_FILE_PATH` Custom absolute path for lock file.

Typical workflows (PowerShell):

```powershell
# Normal start (guard active)
cd 'c:\Users\jabla\OneDrive\Documents\Advanced\Python\jobber-reporting-app\backend'
node server.js

# Force start if lock is stuck (e.g., after abrupt machine restart)
$env:FORCE_START='1'; node server.js; Remove-Item Env:FORCE_START

# Temporarily disable guard
$env:DISABLE_LOCK='1'; node server.js; Remove-Item Env:DISABLE_LOCK
```

If you see:
`[DEV-GUARD] Another backend instance appears to be running (pid=12345).`
Then stop the existing process (Task Manager or `Get-Process node | Stop-Process -Force`) or use `FORCE_START=1` if you are certain it is stale.

### Diagnostics & Observability (Node Backend)

The backend includes lightweight runtime diagnostics for faster debugging.

Environment Variables:
- `DIAG_INTERVAL_SEC` (number, optional): If > 0, logs a structured memory + request snapshot every N seconds (minimum enforced at 5s). Example output:
  `[DIAG][INTERVAL] { label: 'interval', ts: '2025-09-15T17:20:00.123Z', activeRequests: 0, totalRequests: 12, rssMB: 72.4, heapUsedMB: 41.7, heapTotalMB: 52.0, externalKB: 811 }`
- `DIAG_REQUEST_LOG` (`true` to enable): Logs per-request start/end lines:
  `[REQ][START] 13 GET /api/health active= 1` / `[REQ][END] 13 GET /api/health 200 durMs= 3.4 active= 0`.
- `ENABLE_HEARTBEAT` (`true` to enable): 30s heartbeat log (`💓`).

Captured Metrics:
- `activeRequests`: Current in-flight requests.
- `totalRequests`: Cumulative requests since process start.
- `requestTimings.lastMs` / `requestTimings.maxMs`: Last and max observed request durations (ms).
- Memory trio: `rssMB`, `heapUsedMB`, `heapTotalMB`, plus `externalKB`.

Global Error & Signal Snapshots:
- `uncaughtException` / `unhandledRejection` emit: `[FATAL] ... { snap, error }` with the same fields.
- Signals (`SIGINT`, `SIGTERM`, `SIGHUP`) log: `[SIGNAL] SIGINT received { label: 'signal:SIGINT', activeRequests: 0, ... }` then exit.

Typical Enable Sequence (PowerShell):
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item '.\\backend\\.server.lock' -ErrorAction SilentlyContinue
cd 'c:\Users\jabla\OneDrive\Documents\Advanced\Python\jobber-reporting-app\backend'
$env:DIAG_INTERVAL_SEC='10'
$env:DIAG_REQUEST_LOG='true'
node server.js
```

Trigger a Request:
```powershell
curl http://localhost:3000/api/health
```

Disable Noise Quickly:
```powershell
$env:DIAG_REQUEST_LOG=''
$env:DIAG_INTERVAL_SEC='0'
```

Interpreting Memory:
- `rssMB` steady growth could indicate native resource leaks.
- Rising `heapUsedMB` paired with stable `heapTotalMB` is normal until GC expansion.
- If `heapUsedMB` approaches `heapTotalMB` repeatedly while `activeRequests` low, investigate retained objects.

Escalation Checklist:
1. Capture `[DIAG][INTERVAL]` line.
2. Reproduce with a single request.
3. Send most recent `[FATAL]` block (if any) + Node version.

### Data Operations & Efficiency (Priority 2)

Monthly Disk Cache:
- Location: `backend/cache/reports/`
- Pattern: `{plumber}-{year}-{month}.json`
- Past months reused indefinitely (immutable) unless a forced refresh.
- Current month re-fetched unless within `MONTH_CACHE_TTL_MS` (default 6h) and not `?refresh=1`.

Environment Variables:
- `MONTH_CACHE_TTL_MS` (optional) override current month reuse TTL.
- `ADMIN_KEY` secret required for admin refresh endpoint.
- `ADMIN_REFRESH_MIN_INTERVAL` minutes between successive admin refresh calls (default 15).

Public Report Endpoints:
- `GET /api/reports/plumber?name=Lorin&year=2024&refresh=1`
- `GET /api/reports/combined?plumbers=Lorin,Wes&year=2025`

Admin Endpoint:
- `POST /api/admin/refresh-year?year=2025&plumbers=Lorin,Wes,Elijah`
- Headers: `x-admin-key: <ADMIN_KEY>`
- Response includes `nextAllowedAfter` ISO timestamp.
- 429 returned if invoked before interval elapses.

Report Metadata Fields:
- `monthlyData[i].cached` indicates disk slice reuse.
- `meta.year` the target reporting year.
- `meta.refreshRequested` whether refresh bypass was requested.
- `meta.monthCacheTtlMs` effective TTL for current-month reuse.

Operational Examples (PowerShell):
```powershell
# Fetch 2024 report (cached if slices exist)
curl http://localhost:3000/api/reports/plumber?name=Lorin&year=2024

# Force refresh current month/year
curl http://localhost:3000/api/reports/plumber?name=Lorin&refresh=1

# Admin forced year refresh (regenerates slices)
$h = @{ 'x-admin-key' = 'REPLACE_ME' }
Invoke-RestMethod -Uri 'http://localhost:3000/api/admin/refresh-year?year=2025&plumbers=Lorin,Wes' -Method Post -Headers $h
```

Maintenance:
- Clear all caches: `Remove-Item -Recurse -Force .\backend\cache\reports`.
- Remove single month: delete specific JSON file; next request re-fetches.

Security Notes:
- Never commit `ADMIN_KEY` or slice data with sensitive production identifiers.
- `.admin-ops.json` and `cache/` are git-ignored.

### End Data Operations Section

---

## Invoiced Hours Discrepancy Remediation (September 2025)

### Summary
A material mismatch was identified between Python analytics (authoritative CSV) and the Node backend for Wes – August 2025: **125.5 hours (Python)** vs **76 hours (Node)**. Root cause: a stale cached month slice created under an earlier implementation that truncated invoice pagination (hard cap) causing missing late‑month invoices. After removing pagination limits, introducing cache schema versioning, and purging the stale slice, the regenerated August 2025 Node value now exactly matches Python (125.5).

### Key Root Causes
- Historical invoice pagination cap (implicit 3 page limit) silently excluded invoices.
- Stale on-disk month slice persisted the undercount (no automatic invalidation at logic upgrade time).

### Fixes Implemented
1. **Removed invoice pagination cap** (now iterates until `hasNextPage=false`).
2. **Slice Schema Versioning**: `SLICE_SCHEMA_VERSION=2` stored in each `{plumber}-{year}-{month}.json`; older versions auto-invalidated.
3. **Purge & Rebuild Utility**: `purge-rebuild-slices.js` enables targeted deletion + optional regeneration.
4. **Debug Invoice Items Endpoint**: `/api/debug/invoice-items` (guarded by `DEBUG_INVOICE_API=true`) exposes processed invoiceItems & raw line items for auditing.
5. **Reconciliation Script**: `validate-wes-aug-2025.js` generalized for any plumber/year/month to compare Python CSV totals vs Node report.

### Validation Outcome
| Month | Python Adjusted Qty | Node (After Fix) | Delta |
|-------|---------------------|------------------|-------|
| 2025-08 (Wes) | 125.5 | 125.5 | 0.0 |

### Business Rules (Verified Parity)
- Exclude line items named: `Job Details`, `Credit Card Service Fee`.
- Excavation multiplier: quantity ×8.
- Dual lead plumbers: 50/50 split of adjusted quantity.
- Invoiced hours = Σ adjustedQuantity (after transformations) across invoice line items.

---
## Slice Schema Versioning
Each month slice JSON now includes:
```json
{
  "sliceSchemaVersion": 2,
  "plumber": "Wes",
  "month": "2025-08",
  ...
}
```
Invalidation rules:
- Read mismatch (file version != current) ⇒ discard and refetch on demand.
- Future structural changes require incrementing `SLICE_SCHEMA_VERSION`.

When to bump the version:
- Aggregation field semantics change (e.g., invoicedHours definition).
- Additional persisted keys required for downstream logic.
- Major filter or transformation logic changed, making historical slices incomparable.

---
## Purge & Rebuild Utility
Script: `backend/purge-rebuild-slices.js`

Purpose: Safely remove targeted month slice files and optionally trigger regeneration (one YTD fetch per plumber-year).

Common Commands (PowerShell):
```powershell
# Preview (no deletion) a single slice
node purge-rebuild-slices.js --plumber Wes --year 2025 --month 08 --dry

# Purge + regenerate (fresh fetch, bypass in-memory cache)
node purge-rebuild-slices.js --plumber Wes --year 2025 --month 08 --regen --refresh

# Purge all 2025 slices for two plumbers
node purge-rebuild-slices.js --plumbers Lorin,Wes --year 2025

# Purge all plumbers for multiple years (no regen)
node purge-rebuild-slices.js --all --years 2024,2025 --dry
```
Key Flags:
- `--plumber / --plumbers / --all`
- `--year / --years`
- `--month / --months`
- `--regen` (trigger refetch)
- `--refresh` (force bypass in-memory cache during regen)
- `--dry` (simulate only)
- `--verbose` (extra logs)

Exit Codes:
- `0` success
- `1` argument error
- `2` regeneration failures

---
## Reconciliation Workflow
Script: `backend/validate-wes-aug-2025.js` (name retained; works generically).

Usage:
```powershell
# Compare Python CSV vs Node for Wes August 2025 (forces fresh Node fetch when --refresh provided)
node validate-wes-aug-2025.js --plumber Wes --year 2025 --month 08 --refresh
```
Output Fields:
- Python total adjusted quantity (authoritative expected invoiced hours).
- Node report invoicedHours.
- Difference (Node - Python).
- Worked hours & utilization (contextual, not part of reconciliation pass/fail).

Success Criteria:
- Absolute difference ≤ 0.1 hours (rounding tolerance). Current delta: 0.0.

If a discrepancy persists:
1. Enable debugging (see next section) and collect invoiceItems via debug endpoint.
2. Confirm missing invoice numbers exist in CSV but absent in Node payload.
3. Inspect for `hasNextPage` on invoice `lineItems` (potential need for deeper per-invoice pagination).

---
## Debug Invoice Items Endpoint
Endpoint: `GET /api/debug/invoice-items?plumber=<Name>&month=YYYY-MM`

Enable:
```powershell
$env:DEBUG_INVOICE_API='true'; node server.js
```
Example:
```powershell
curl http://localhost:3000/api/debug/invoice-items?plumber=Wes&month=2025-08 | jq '.'
```
Response (fields):
- `invoicedHours` – month aggregate from normal report logic.
- `invoiceItems[]` – processed items (post business rules).
- `rawInvoiceLineItems[]` – raw line items prior to filtering & transformations.

Disable:
```powershell
Remove-Item Env:DEBUG_INVOICE_API
```
Security Considerations:
- Keep disabled by default; can expose raw invoice metadata.
- Avoid enabling in shared/staging environments without access control.

---
## Convenience NPM Scripts
Added to `backend/package.json`:
```json
{
  "scripts": {
    "purge:wes:aug2025": "node purge-rebuild-slices.js --plumber Wes --year 2025 --month 08 --regen --refresh",
    "reconcile:wes:aug2025": "node validate-wes-aug-2025.js --plumber Wes --year 2025 --month 08 --refresh",
    "purge:all:2025": "node purge-rebuild-slices.js --all --year 2025 --regen --refresh",
    "debug:invoice:wes:aug2025": "powershell -NoLogo -NoProfile -Command \"Invoke-WebRequest -UseBasicParsing 'http://localhost:3000/api/debug/invoice-items?plumber=Wes&month=2025-08' | Select-Object -ExpandProperty Content\""
  }
}
```
Run examples:
```powershell
npm run purge:wes:aug2025
npm run reconcile:wes:aug2025
```

---
## Operational Playbook (Post-Remediation)
1. Suspect mismatch? Run reconciliation script for target month.
2. If mismatch: purge slice + regenerate.
3. Still mismatch: enable debug endpoint, fetch invoiceItems, compare against CSV inputs.
4. If partial invoice found with `hasNextPage=true` lineItems: implement deeper invoice line pagination.
5. Confirm fix → update slice schema version if structural change → document.

---
## Future Enhancements (Backlog)
- Per-invoice line item pagination loop (only if `hasNextPage` detected in the wild).
- Automated monthly integrity test: cron-style script running reconciliation for prior month after close.
- Optional persistent audit log of purge & regeneration operations.

---
## Changelog (Remediation Segment)
- 2025-09-17: Added slice schema versioning (v2), purge utility, debug endpoint, reconciliation parity achieved (Wes 2025-08).
