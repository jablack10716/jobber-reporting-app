# Jobber Reporting App - Copilot Instructions

## Project Status
- [x] Verify that the copilot-instructions.md file in the .github directory is created.
- [x] Clarify Project Requirements
- [x] Scaffold the Project
- [x] Customize the Project
- [x] Install Required Extensions
- [x] Compile the Project
- [x] Create and Run Task
- [x] Launch the Project
- [x] Ensure Documentation is Complete

## Development Guidelines
- Work through each checklist item systematically.
- Keep communication concise and focused.
- Follow development best practices.

### Jobber API Integration
This project integrates with the Jobber API for retrieving business data (clients, jobs, invoices, etc.). 

**Primary Documentation Reference:**
- Jobber Developer Documentation: https://developer.getjobber.com/docs
- GraphQL API Reference: https://developer.getjobber.com/docs/api/graphql
- OAuth Authentication Guide: https://developer.getjobber.com/docs/api/authentication
- Rate Limiting: https://developer.getjobber.com/docs/api/rate-limiting

**Key Integration Points:**
- OAuth 2.0 flow for user authentication and token management
- GraphQL queries for retrieving plumber performance data
- Scopes required: `read_clients`, `read_jobs`, `read_invoices`, `read_jobber_payments`, `read_users`, `read_expenses`, `read_custom_field_configurations`, `read_time_sheets`
- API versioning via `X-JOBBER-GRAPHQL-VERSION` header (currently using `2025-01-20`)

**GraphQL Schema Reference:**
The Jobber API uses GraphQL with the following root types:
- Root Types: `query: Query`, `mutation: Mutation`

Key types for plumber reporting functionality:
- `User`: Represents plumbers/employees with fields like `name { first, last }`, `email { address }`
- `Job`: Work orders with fields like `jobNumber`, `title`, `jobStatus`, `assignedUsers`, `totalAmount`
- `Invoice`: Billing records with `invoiceNumber`, `total`, `sentAt`, `paidAt`, linked to jobs
- `TimeSheetEntry`: Time tracking data for productivity analysis
- `Client`: Customer information linked to jobs and invoices
- `Visit`: Individual service visits with completion status and line items

**Schema Field Structure Notes:**
- Complex fields like `name` and `email` require sub-selections (e.g., `name { first, last }`)
- User queries need `email { address }` format, not just `email`
- Removed fields: `subscriptionStatus` (not available on Account type)
- Connection pattern: Most lists use `edges { node { ... } }` GraphQL connection structure

**Complete Jobber GraphQL Schema Types (2025-01-20):**
Root types: `query: Query`, `mutation: Mutation`

All available schema types:
`Account`, `AccountFeature`, `AccountUnsafe`, `AchBankPaymentPaymentRecord`, `AddressAttributes`, `AddressInterface`, `AdvanceBalanceTransaction`, `AdvanceFundingBalanceTransaction`, `AppAlert`, `AppAlertConnection`, `AppAlertEdge`, `AppAlertEditInput`, `AppAlertEditPayload`, `AppDisconnectPayload`, `AppInstanceLastSyncDateEditPayload`, `Application`, `ApplicationConnection`, `ApplicationEdge`, `AppointmentAllDayInput`, `AppointmentEditAssignmentInput`, `AppointmentEditAssignmentPayload`, `AppointmentEditCompletenessInput`, `AppointmentEditCompletenessPayload`, `AppointmentEditScheduleInput`, `AppointmentEditSchedulePayload`, `AppointmentScheduleInput`, `ArrivalWindow`, `ArrivalWindowAttributes`, `Assessment`, `AssessmentCompletePayload`, `AssessmentCreateInput`, `AssessmentCreatePayload`, `AssessmentDeletePayload`, `AssessmentEditInput`, `AssessmentEditPayload`, `AssessmentUncompletePayload`, `BalanceTransaction`, `BalanceTransactionInterface`, `BalanceTransactionInterfaceConnection`, `BalanceTransactionInterfaceEdge`, `BankTransferPaymentRecord`, `BillingFrequencyEnum`, `BillingStrategy`, `Boolean`, `CapitalLoanAcceptanceSource`, `CapitalLoanFilterAttributes`, `CapitalLoanStatus`, `CashAppPaymentRecord`, `CashPaymentRecord`, `CheckPaymentRecord`, `Client`, `ClientAddress`, `ClientAddressUpdateAttributes`, `ClientArchivePayload`, `ClientConnection`, `ClientCounts`, `ClientCreateInput`, `ClientCreateNoteInput`, `ClientCreateNotePayload`, `ClientCreatePayload`, `ClientDeleteNoteInput`, `ClientDeleteNotePayload`, `ClientEdge`, `ClientEditInput`, `ClientEditNoteInput`, `ClientEditNotePayload`, `ClientEditPayload`, `ClientFilterAttributes`, `ClientMeta`, `ClientNote`, `ClientNoteAddAttachmentPayload`, `ClientNoteConnection`, `ClientNoteEdge`, `ClientNoteFile`, `ClientNoteFileConnection`, `ClientNoteFileEdge`, `ClientNoteLinkInput`, `ClientPhoneFilterAttributes`, `ClientPhoneNumber`, `ClientPhoneNumberConnection`, `ClientPhoneNumberEdge`, `ClientTitle`, `ClientUnarchivePayload`, `ClientsCreatePayload`, `ClientsSortInput`, `Color`, `ContactCreateAttributes`, `ContactEditAttributes`, `ContactFilterInput`, `ContactModel`, `ContactModelConnection`, `ContactModelEdge`, `ContactsSortInput`, `ContactsSortKey`, `CostModifierAttributes`, `CostModifierTypeEnum`, `CreatePayload`, `CreditCardPaymentRecord`, `CustomFieldAppliesTo`, `CustomFieldArea`, `CustomFieldAreaValue`, `CustomFieldConfiguration`, `CustomFieldConfigurationArchivePayload`, `CustomFieldConfigurationArea`, `CustomFieldConfigurationAreaDefaultValue`, `CustomFieldConfigurationAreaDefaultValueInput`, `CustomFieldConfigurationConnection`, `CustomFieldConfigurationCreateAreaInput`, `CustomFieldConfigurationCreateAreaPayload`, `CustomFieldConfigurationCreateDropdownInput`, `CustomFieldConfigurationCreateDropdownPayload`, `CustomFieldConfigurationCreateLinkInput`, `CustomFieldConfigurationCreateLinkPayload`, `CustomFieldConfigurationCreateNumericInput`, `CustomFieldConfigurationCreateNumericPayload`, `CustomFieldConfigurationCreateTextInput`, `CustomFieldConfigurationCreateTextPayload`, `CustomFieldConfigurationCreateTrueFalseInput`, `CustomFieldConfigurationCreateTrueFalsePayload`, `CustomFieldConfigurationDropdown`, `CustomFieldConfigurationEdge`, `CustomFieldConfigurationEditAreaInput`, `CustomFieldConfigurationEditDropdownInput`, `CustomFieldConfigurationEditInput`, `CustomFieldConfigurationEditLinkInput`, `CustomFieldConfigurationEditNumericInput`, `CustomFieldConfigurationEditPayload`, `CustomFieldConfigurationEditTextInput`, `CustomFieldConfigurationEditTrueFalseInput`, `CustomFieldConfigurationInterface`, `CustomFieldConfigurationLink`, `CustomFieldConfigurationLinkDefaultValue`, `CustomFieldConfigurationLinkDefaultValueInput`, `CustomFieldConfigurationNumeric`, `CustomFieldConfigurationText`, `CustomFieldConfigurationTrueFalse`, `CustomFieldConfigurationUnarchivePayload`, `CustomFieldConfigurationValueType`, `CustomFieldConfigurationsFilterInput`, `CustomFieldConfigurationsSortInput`, `CustomFieldConfigurationsSortKey`, `CustomFieldCreateInput`, `CustomFieldDropdown`, `CustomFieldEditInput`, `CustomFieldLink`, `CustomFieldLinkValue`, `CustomFieldNumeric`, `CustomFieldText`, `CustomFieldTrueFalse`, `CustomFieldUnion`, `CustomFieldValueAreaInput`, `CustomFieldValueLinkInput`, `CustomFieldsInterface`, `CustomLeadSource`, `DateRange`, `DepositBalanceTransaction`, `DevicePlatform`, `DiscountInput`, `DisputeBalanceTransaction`, `DurationUnit`, `EPaymentPaymentRecord`, `ETransferPaymentRecord`, `EditPayload`, `Email`, `EmailConnection`, `EmailCreateAttributes`, `EmailDescription`, `EmailEdge`, `EmailFilterInput`, `EmailInterface`, `EmailTypes`, `EmailUpdateAttributes`, `EncodedId`, `Event`, `EventCreateInput`, `EventCreatePayload`, `Expense`, `ExpenseConnection`, `ExpenseCreateInput`, `ExpenseCreatePayload`, `ExpenseDeletePayload`, `ExpenseEdge`, `ExpenseEditInput`, `ExpenseEditPayload`, `ExpenseFilterAttributes`, `ExpensesSortInput`, `ExpensesSortKey`, `FeeAdjustmentBalanceTransaction`, `FileAttachmentAttributes`, `FinancingPayoutBalanceTransaction`, `FinancingRepaymentBalanceTransaction`, `Float`, `FloatRangeInput`, `FormInput`, `FormItemInput`, `FormSectionInput`, `GPSPositionInput`, `GeoPoint`, `GeoStatus`, `GpsPositionType`, `ICalendarRule`, `ID`, `ISO8601Date`, `ISO8601DateTime`, `ISO8601Time`, `IncomeAdjustmentType`, `IncompleteVisitDecisionEnum`, `Industry`, `InstantPayoutBalanceTransaction`, `InstantPayoutFeeBalanceTransaction`, `Int`, `IntRangeInput`, `Invoice`, `InvoiceAmounts`, `InvoiceBillingAddress`, `InvoiceClientViewOptionsInput`, `InvoiceConnection`, `InvoiceCreateNoteInput`, `InvoiceCreateNotePayload`, `InvoiceDueDetails`, `InvoiceEdge`, `InvoiceEditInput`, `InvoiceEditNoteInput`, `InvoiceEditNotePayload`, `InvoiceEditPayload`, `InvoiceFilterAttributes`, `InvoiceLineItem`, `InvoiceLineItemConnection`, `InvoiceLineItemEdge`, `InvoiceNote`, `InvoiceNoteFile`, `InvoiceNoteFileConnection`, `InvoiceNoteFileEdge`, `InvoiceNoteUnion`, `InvoiceNoteUnionConnection`, `InvoiceNoteUnionEdge`, `InvoiceOrigin`, `InvoicePaymentRecordAllocation`, `InvoiceSchedule`, `InvoiceSortInput`, `InvoiceSortKey`, `InvoiceStatusTypeEnum`, `Iso8601DateTimeRangeInput`, `JSON`, `Job`, `JobBalanceTotals`, `JobCloseInput`, `JobClosePayload`, `JobConnection`, `JobCosting`, `JobCreateAttributes`, `JobCreateLineItemAttributes`, `JobCreateLineItemsInput`, `JobCreateLineItemsPayload`, `JobCreateNoteInput`, `JobCreateNotePayload`, `JobCreatePayload`, `JobDeleteLineItemsInput`, `JobDeleteLineItemsPayload`, `JobDeleteNoteInput`, `JobDeleteNotePayload`, `JobEdge`, `JobEditInput`, `JobEditLineItemAttributes`, `JobEditLineItemsInput`, `JobEditLineItemsPayload`, `JobEditNoteInput`, `JobEditNotePayload`, `JobEditPayload`, `JobFilterAttributes`, `JobInvoicingAttributes`, `JobLineItem`, `JobLineItemConnection`, `JobLineItemEdge`, `JobNote`, `JobNoteAddAttachmentPayload`, `JobNoteFile`, `JobNoteFileConnection`, `JobNoteFileEdge`, `JobNoteLinkInput`, `JobNoteUnion`, `JobNoteUnionConnection`, `JobNoteUnionEdge`, `JobOrderLineItemsPayload`, `JobReopenPayload`, `JobSchedulingAttributes`, `JobSortKey`, `JobStatusTypeEnum`, `JobTypeTypeEnum`, `JobberPaymentTransactionStatus`, `JobberPaymentsACHPaymentRecord`, `JobberPaymentsCapitalLoan`, `JobberPaymentsCapitalLoanConnection`, `JobberPaymentsCapitalLoanEdge`, `JobberPaymentsCreditCardPaymentRecord`, `JobberPaymentsPaymentMethodFilterAttributes`, `JobberPaymentsRefundPaymentRecord`, `JobsSortInput`, `LastSyncDate`, `LastSyncDateEditInput`, `LineItemInterface`, `LiveState`, `LiveStateInput`, `LocalDateTimeAttributes`, `MessageInterfaceConnection`, `MessageInterfaceEdge`, `Minutes`, `MoneyOrderPaymentRecord`, `MutationErrors`, `Name`, `NoteAttachmentAttributes`, `NoteAttachmentSortAttributes`, `NoteAttachmentsSortableFieldsEnum`, `NoteCreatedByUnion`, `NoteFileInterface`, `NoteFileInterfaceConnection`, `NoteFileInterfaceEdge`, `NoteFileStatusEnum`, `NoteInterface`, `NoteLink`, `NotesSortInput`, `NotesSortableFields`, `OnMyWayTrackingLink`, `OnMyWayTrackingLinkCreateInput`, `OnMyWayTrackingLinkCreatePayload`, `OnlineBookingConfiguration`, `OtherPaymentRecord`, `PageInfo`, `PaymentBalanceTransaction`, `PaymentMethodInterfaceConnection`, `PaymentMethodInterfaceEdge`, `PaymentMethodSource`, `PaymentOrigin`, `PaymentRecord`, `PaymentRecordAllocationInterface`, `PaymentRecordAllocationInterfaceConnection`, `PaymentRecordAllocationInterfaceEdge`, `PaymentRecordConnection`, `PaymentRecordEdge`, `PaymentRecordFilterAttributes`, `PaymentRecordInterface`, `PaymentRecordInterfaceConnection`, `PaymentRecordInterfaceEdge`, `PaymentRecordRefund`, `PaymentRecordRefundConnection`, `PaymentRecordRefundEdge`, `PaymentType`, `Payout`, `PayoutFilterAttributes`, `PayoutMethod`, `PayoutRecord`, `PayoutRecordConnection`, `PayoutRecordEdge`, `PayoutSortInput`, `PayoutSortKey`, `PayoutStatus`, `PaypalPaymentRecord`, `PermissionAreaFilterEnum`, `PermissionLevelFilterEnum`, `PhoneFilterInput`, `PhoneNumberCreateAttributes`, `PhoneNumberDescription`, `PhoneNumberInterface`, `PhoneNumberUpdateAttributes`, `Processor`, `ProductOrService`, `ProductOrServiceConnection`, `ProductOrServiceEdge`, `ProductsAndServicesCategory`, `ProductsAndServicesEditInput`, `ProductsAndServicesInput`, `ProductsAndServicesSortInput`, `ProductsAndServicesSortKey`, `ProductsFilterInput`, `PropertiesFilterAttributes`, `Property`, `PropertyAddress`, `PropertyAttributes`, `PropertyConnection`, `PropertyContactFilterAttributes`, `PropertyCreateInput`, `PropertyCreatePayload`, `PropertyEdge`, `PropertyEditAttributes`, `PropertyEditInput`, `PropertyEditPayload`, `QuantityRange`, `QuantityRangeInput`, `Quote`, `QuoteAmounts`, `QuoteClientViewOptionsInput`, `QuoteConnection`, `QuoteCreateAttributes`, `QuoteCreateLineItemAttributes`, `QuoteCreateLineItemsPayload`, `QuoteCreateNoteInput`, `QuoteCreateNotePayload`, `QuoteCreatePayload`, `QuoteCreateTextLineItemAttributes`, `QuoteCreateTextLineItemsPayload`, `QuoteDeleteLineItemsPayload`, `QuoteEdge`, `QuoteEditAttributes`, `QuoteEditLineItemAttributes`, `QuoteEditLineItemsPayload`, `QuoteEditNoteInput`, `QuoteEditNotePayload`, `QuoteEditPayload`, `QuoteFilterAttributes`, `QuoteJobsSortInput`, `QuoteJobsSortKey`, `QuoteLastTransitioned`, `QuoteLineItem`, `QuoteLineItemConnection`, `QuoteLineItemEdge`, `QuoteLineItemFilterAttributes`, `QuoteNote`, `QuoteNoteFile`, `QuoteNoteFileConnection`, `QuoteNoteFileEdge`, `QuoteNoteLinkInput`, `QuoteNoteUnion`, `QuoteNoteUnionConnection`, `QuoteNoteUnionEdge`, `QuoteStatusTypeEnum`, `QuotesSortInput`, `QuotesSortKey`, `RecurrenceSchedule`, `RefundBalanceTransaction`, `RefundFeeBalanceTransaction`, `Request`, `RequestArchivePayload`, `RequestConnection`, `RequestCreateInput`, `RequestCreateNoteInput`, `RequestCreateNotePayload`, `RequestCreatePayload`, `RequestDetailsInput`, `RequestEdge`, `RequestEditInput`, `RequestEditNoteInput`, `RequestEditNotePayload`, `RequestEditPayload`, `RequestFilterAttributes`, `RequestNote`, `RequestNoteFile`, `RequestNoteFileConnection`, `RequestNoteFileEdge`, `RequestNoteLinkInput`, `RequestNoteUnion`, `RequestNoteUnionConnection`, `RequestNoteUnionEdge`, `RequestSettings`, `RequestSettingsConnection`, `RequestSettingsEdge`, `RequestStatusTypeEnum`, `RequestUnarchivePayload`, `RequestsSortInput`, `RequestsSortKey`, `ReservedFundsBalanceTransaction`, `ScheduleDetailsInterface`, `ScheduledItemAttributes`, `ScheduledItemInterface`, `ScheduledItemInterfaceConnection`, `ScheduledItemInterfaceEdge`, `ScheduledItemStatus`, `ScheduledItemType`, `ScheduledItemsFilterAttributes`, `ScheduledItemsSortInput`, `ScheduledItemsSortKey`, `SchedulingAspect`, `Seconds`, `SelfServeBooking`, `SignatureInput`, `SortDirectionEnum`, `Source`, `SourceAttribution`, `SourceAttributionAttributes`, `SourceAttributionSource`, `String`, `Tag`, `TagConnection`, `TagEdge`, `Task`, `TaskConnection`, `TaskCreateInput`, `TaskCreatePayload`, `TaskDeletePayload`, `TaskEdge`, `TaskEditInput`, `TaskEditPayload`, `TaskFilterAttributes`, `TaskSortInput`, `TaskSortableFields`, `TaxCreateInput`, `TaxCreatePayload`, `TaxDetails`, `TaxGroupCreateInput`, `TaxGroupCreatePayload`, `TaxRate`, `TaxRateBase`, `TaxRateConnection`, `TaxRateEdge`, `TerminalReader`, `TimeSheetEntriesFilterAttributes`, `TimeSheetEntriesSortAttributes`, `TimeSheetEntriesSortableFieldsEnum`, `TimeSheetEntry`, `TimeSheetEntryConnection`, `TimeSheetEntryEdge`, `TimeframeAttributes`, `Timezone`, `True`, `UnknownBalanceTransaction`, `UpdateFutureVisitsInput`, `UpdateFutureVisitsOptionsInput`, `UpdateFutureVisitsPayload`, `Url`, `User`, `UserAddress`, `UserConnection`, `UserEdge`, `UserEditInput`, `UserEditPayload`, `UserEmail`, `UserErrorsInterface`, `UserFirstDayOfTheWeekEnum`, `UserInterface`, `UserPermissionFilterAttributes`, `UserPhone`, `UserStatusEnum`, `UsersFilterAttributes`, `UsersStatusFilterEnum`, `ValueCount`, `Vehicle`, `VehicleConnection`, `VehicleCreateInput`, `VehicleCreatePayload`, `VehicleDeletePayload`, `VehicleEdge`, `VehicleStatus`, `VehicleUpdateInput`, `VehiclesUpdatePayload`, `VenmoPaymentRecord`, `Visit`, `VisitActionUponComplete`, `VisitCompletePayload`, `VisitConnection`, `VisitCreateAttributes`, `VisitCreateInput`, `VisitCreateLineItemAttributes`, `VisitCreateLineItemInput`, `VisitCreateLineItemsPayload`, `VisitCreatePayload`, `VisitDeleteLineItemsInput`, `VisitDeleteLineItemsPayload`, `VisitDeletePayload`, `VisitEdge`, `VisitEditAssignedUsersInput`, `VisitEditAssignedUsersPayload`, `VisitEditAttributes`, `VisitEditLineItemAttributes`, `VisitEditLineItemsInput`, `VisitEditLineItemsPayload`, `VisitEditPayload`, `VisitEditScheduleInput`, `VisitEditSchedulePayload`, `VisitFilterAttributes`, `VisitInvoiceStatus`, `VisitSchedule`, `VisitStatusTypeEnum`, `VisitUncompletePayload`, `VisitsInfo`, `VisitsSortInput`, `VisitsSortableFields`, `WebHookPayload`, `WebHookTopicEnum`, `Webhook`, `WebhookEndpoint`, `WebhookEndpointCreateInput`, `WebhookEndpointCreatePayload`, `WebhookEndpointDeletePayload`, `WonDisputeBalanceTransaction`, `WorkItem`, `WorkItemCategoryTypeEnum`, `WorkObjectSendMessageType`, `WorkObjectUnion`, `WorkObjectUnionConnection`, `WorkObjectUnionEdge`, `ZellePaymentRecord`

**Troubleshooting Resources:**
- Refer to Jobber Developer Documentation for OAuth flow issues, API rate limits, and GraphQL schema updates
- Check API status and known issues at Jobber's developer portal
- Validate API scopes and permissions when encountering 403/401 errors
- For schema validation errors, use GraphiQL tool at Developer Center for field exploration

### Critical Business Logic Implementation

**Invoice Calculation Logic (RESOLVED 2024-09-15):**
- **CRITICAL FIX**: JavaScript code now correctly excludes "Job Details" line items from invoice calculations, matching Python reference exactly
- **Processing**: Uses `processInvoiceData()` function with filtered line items instead of total invoice amount
- **Lead Plumber Splitting**: Validated 50/50 split logic for two different lead plumbers (matches Python implementation)
- **Custom Fields**: Fixed `getCustomFieldValue()` for proper GraphQL structure handling
- **Line Items**: Revenue calculated from `adjustedQuantity * unitPrice` for non-"Job Details" items only

**Data Refresh & Validation:**
- **Controlled Refresh Script**: `backend/refresh-data.js` with conservative rate limiting (45s between plumbers, 2s between months)
- **Cache System**: 10-minute TTL with `refresh=1` parameter support for cache bypass
- **Error Handling**: Robust fallback data handling for API failures
- **Validation Results**: Corrected calculation shows $800 revenue vs old incorrect $1000 (excludes $200 Job Details)

**Rate Limiting Strategy:**
- **Jobber API Limits**: 10,000 point maximum, 500 points/sec restore rate
- **Query Costs**: Invoice queries = 685 points, Timesheet queries = 145 points  
- **Batch Sizes**: 20 invoices/timesheet entries per batch, 3 line items per invoice
- **Conservative Delays**: 45s between plumbers, handles 429 errors with extension to 60s

### Testing Session Auto-Restart Policy
During active testing phases, the Copilot agent should automatically restart the Node backend server (and frontend dev server if applicable) after applying code changes that affect runtime behavior (API, build artifacts, or React pages). The agent will:
1. Gracefully stop existing node processes (separate kill + start, no chained single-line unless necessary).
2. Rebuild the frontend when UI or bundling changes were made before copying build assets.
3. Verify availability via /api/health and a sample domain endpoint (e.g., /api/reports/plumber?name=Lorin).
4. Report only concise PASS/FAIL summaries unless deeper logs are explicitly requested.
If a restart is unsafe (e.g., pending unsaved edits or ambiguous environment), the agent will request clarification instead of proceeding silently.

### Local Development Port Strategy (Option A)
We use a stable split-port approach:

Backend (Node/Express mock + static prod build): http://localhost:3000
Frontend React Dev Server (hot reload): http://localhost:3001

Implementation details:
1. A file `frontend/.env.development.local` pins `PORT=3001` so the CRA dev server never collides with the backend.
2. The backend `server.js` intentionally hardcodes `const port = 3000;` for predictable OAuth redirect / API base URLs.
3. Production-style testing (single port) = run only the backend after copying the latest `frontend/build` to `backend/build`.
4. Live‑reload UI development = run both (backend on 3000, CRA dev server on 3001). CRA will proxy API calls if a proxy is later configured; currently you can point the browser directly to :3001 while API calls hit :3000.

Common commands (PowerShell):
```
# Start backend (from repo root or backend dir)
cd backend; node server.js

# Start frontend dev server (hot reload) – port fixed by .env.development.local
cd ../frontend; npm start

# Rebuild production bundle and redeploy to backend static build
cd frontend; npm run build; cd ..; if (Test-Path backend/build) { Remove-Item -Recurse -Force backend/build }; Copy-Item -Recurse frontend/build backend/build
```

### Troubleshooting Guide

#### Critical Server Issues (Resolved)
- **OAuth Infinite Redirect Loop**: The OAuth route `/auth/*` can cause infinite redirects due to browser cookie issues. If server becomes unreachable immediately after startup, temporarily disable OAuth route by commenting out lines 244-282 in `backend/server.js` with `/* */` blocks.
- **PowerShell Directory Navigation**: Always use absolute paths with single quotes: `cd 'c:\Users\jabla\OneDrive\Documents\Advanced\Python\jobber-reporting-app\backend'`. Relative `cd backend` commands fail in PowerShell across multiple terminal sessions.
- **Server Startup Success vs. Accessibility**: Server can show successful startup logs ("🚀 Jobber API server running on http://0.0.0.0:3000") but still be unreachable. This indicates process termination after startup, not startup failure.
- **Manual Terminal vs. Task Runner**: Direct PowerShell commands often result in unstable server processes that exit after ~10 seconds. VS Code's built-in task runner provides significantly more reliable server persistence and process management.

#### Working Server Start Commands
```powershell
# CORRECT - Always use absolute path with && operator
cd 'c:\Users\jabla\OneDrive\Documents\Advanced\Python\jobber-reporting-app\backend' && node server.js

# INCORRECT - These cause directory/startup issues
cd backend; node server.js
node backend/server.js
```

#### VS Code Task Runner (Most Reliable)
**Recommended Approach**: Use VS Code's built-in task runner for most reliable server startup and persistence:
- VS Code Command Palette → "Tasks: Run Task" → "Run Backend Server"
- Task automatically handles directory navigation and process management
- Provides integrated terminal output with better error handling
- Less prone to PowerShell session and environment variable issues
- Maintains server process stability compared to manual terminal commands

#### Port and Process Management
- If the frontend tries another port (e.g., 5000) it means `PORT=3001` env file was not picked up; ensure the filename is exactly `.env.development.local` and restart `npm start`.
- If 3001 appears in use, terminate stray processes: `Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force`.
- If backend logs show immediate shutdown, check `backend/server-error.log` for uncaught exceptions.
- Use `Stop-Process -Name node -Force -ErrorAction SilentlyContinue` before each server restart to prevent port conflicts.

#### Syntax and Dependency Validation
- Always run `node -c server.js` for syntax validation before attempting to start server.
- Test imports individually: `node -e "require('./JobberAPIService'); console.log('OK');"` to isolate dependency issues.
- Server startup logs should show: "[TRACE] server.js starting load" → "🚀 Jobber API server running" → "✅ Post-start 1500ms tick".

#### Production Build Deployment
```powershell
# Standard frontend build and deploy to backend
cd 'c:\Users\jabla\OneDrive\Documents\Advanced\Python\jobber-reporting-app'
if (Test-Path backend\build) { Remove-Item -Recurse -Force backend\build }
Copy-Item -Recurse frontend\build backend\build
```

#### Health Check Verification
```powershell
# Verify server accessibility after startup
Start-Sleep -Seconds 3
try { 
    $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing
    Write-Host "✅ Server accessible: $($response.StatusCode)"
} catch { 
    Write-Host "❌ Server failed: $($_.Exception.Message)"
}
```

#### OAuth Route Management
- OAuth route (`/auth/callback`) can cause server crashes with infinite redirects
- Temporarily disable by wrapping in `/* */` comments if server becomes immediately unreachable
- Re-enable only after confirming server stability without OAuth
- OAuth issues manifest as immediate server termination, not startup errors

### Observability & Runtime Diagnostics

Added lightweight diagnostics to `backend/server.js`:

Features:
- Active request tracking (in-flight + total count)
- Per-request start/end logging (enable with `DIAG_REQUEST_LOG=true`)
- Interval memory snapshots (enable with `DIAG_INTERVAL_SEC>0`)
- Signal annotations (`SIGINT`, `SIGTERM`, `SIGHUP`) with snapshot context
- Enhanced `uncaughtException` / `unhandledRejection` logs including memory + request stats

Environment Variables:
- `DIAG_INTERVAL_SEC`: Number of seconds between `[DIAG][INTERVAL]` logs (minimum 5 when >0). Set to `0` or unset to disable.
- `DIAG_REQUEST_LOG`: Set to `true` to emit `[REQ][START]` / `[REQ][END]` lines.
- `ENABLE_HEARTBEAT`: Independent 30s heartbeat (`💓`) when `true` for liveness noise.

Sample Startup (PowerShell):
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item '.\\backend\\.server.lock' -ErrorAction SilentlyContinue
cd 'c:\Users\jabla\OneDrive\Documents\Advanced\Python\jobber-reporting-app\backend'
$env:DIAG_INTERVAL_SEC='15'
$env:DIAG_REQUEST_LOG='true'
node server.js
```

Sample Output Snippets:
```
[DIAG] Interval memory logging enabled every 15s
[REQ][START] 1 GET /api/health active= 1
[REQ][END] 1 GET /api/health 200 durMs= 3.4 active= 0
[DIAG][INTERVAL] { label: 'interval', activeRequests: 0, totalRequests: 6, rssMB: 70.2, heapUsedMB: 39.1, heapTotalMB: 51.0, externalKB: 820 }
[SIGNAL] SIGINT received { label: 'signal:SIGINT', activeRequests: 0, totalRequests: 9, ... }
```

Operational Guidance:
1. Use interval + request logging only during short investigations to avoid log bloat.
2. Capture at least two `[DIAG][INTERVAL]` lines a few seconds apart when reporting memory concerns.
3. For suspected leak, increase traffic (e.g., loop curl) and watch `heapUsedMB` trend.
4. If signals appear unexpectedly, correlate with external tooling (IDE restart, task runner) not an internal crash.

Disable Quickly:
```powershell
$env:DIAG_REQUEST_LOG=''
$env:DIAG_INTERVAL_SEC='0'
```

Escalation Data Package:
- Last `[FATAL]` block (if present)
- Two consecutive `[DIAG][INTERVAL]` lines
- Node version (`node -v`)
- Number of concurrent requests if reproducible

### End Observability Section

### Core Files Architecture

**Backend Core Files:**
- `backend/server.js`: Main API server with caching, OAuth routes, health endpoints
- `backend/jobber-queries.js`: Business logic for invoice/timesheet processing (UPDATED with corrected logic)
- `backend/JobberAPIService.js`: Jobber API client with token management and GraphQL queries
- `backend/refresh-data.js`: Controlled data refresh script for historical data updates
- `backend/.env`: Environment configuration for API credentials and URLs

**Frontend Core Files:**
- `frontend/src/components/`: React components for plumber reporting UI
- `frontend/.env.development.local`: PORT=3001 configuration for development
- `frontend/build/`: Production build artifacts deployed to `backend/build/`

**Key Integration Points:**
- Cache system: In-memory cache with TTL, supports refresh parameter
- API endpoints: `/api/reports/plumber?name=X&refresh=1`, `/api/reports/combined`
- Authentication: OAuth 2.0 flow with token persistence in `backend/tokens.json`
- Data processing: Real-time API fetching with fallback to cached/mock data

**Critical Dependencies:**
- GraphQL client: `graphql-request` for Jobber API communication  
- Express server: CORS-enabled with static file serving for production builds
- Environment loading: `dotenv` for configuration management

### Deployment and Maintenance

**Data Refresh Procedures:**
1. **Controlled Refresh**: Use `node refresh-data.js` for updating historical data with corrected logic
2. **Rate Limit Monitoring**: Watch for 429 responses, script automatically extends delays
3. **Cache Invalidation**: Use `refresh=1` parameter on API endpoints to bypass cache
4. **Validation**: Use `node test-validation.js` for comprehensive feature testing (6 test categories)
5. **Admin Operations**: Use `POST /api/admin/refresh-year` with proper authentication for bulk updates

**Production Deployment:**
```powershell
# Build and deploy frontend to backend
cd 'c:\Users\jabla\OneDrive\Documents\Advanced\Python\jobber-reporting-app\frontend'
npm run build
cd ..
if (Test-Path backend\build) { Remove-Item -Recurse -Force backend\build }
Copy-Item -Recurse frontend\build backend\build

# Start production server
cd backend
node server.js
```

**Environment Variables Required:**
- `JOBBER_API_URL`: Jobber GraphQL endpoint
- `JOBBER_CLIENT_ID`: OAuth application client ID
- `JOBBER_CLIENT_SECRET`: OAuth application secret
- `JOBBER_REDIRECT_URI`: OAuth callback URL (typically http://localhost:3000/auth/callback)
- `JOBBER_GRAPHQL_VERSION`: API version header (2025-01-20)
- `TOKEN_STORAGE_PATH`: Path to tokens.json file

### Project Management Guidelines

**Development Workflow:**
1. Always verify syntax with `node -c server.js` before running code
2. Use absolute paths for PowerShell commands: `cd 'full-path' && command`
3. Stop existing processes before server restarts: `Stop-Process -Name node -Force -ErrorAction SilentlyContinue`
4. Test both individual endpoints and full application flow after changes
5. Monitor API rate limits during data refresh operations

**Code Quality Standards:**
- Match Python reference implementation exactly for business logic
- Exclude "Job Details" line items from invoice calculations
- Handle GraphQL structure correctly (nested objects, connection patterns)
- Implement proper error handling with fallback data
- Use conservative API rate limiting to avoid 429 errors

**Testing Strategies:**
- **Unit Testing**: Validate invoice calculation logic against known test cases
- **Integration Testing**: Test full API flow with real Jobber data
- **Rate Limit Testing**: Verify refresh scripts respect API limits
- **Cache Testing**: Confirm cache bypass and TTL behavior
- **Production Testing**: Deploy frontend build and test static file serving

Rationale:
Keeping the backend fixed on 3000 avoids updating OAuth redirect URIs and external references, while 3001 provides isolation for fast React iterations without port churn.

Future enhancement (optional): Allow backend to honor `process.env.PORT` for deployment targets while defaulting to 3000 locally.

### Data Operations & Efficiency Additions (Priority 2) - ✅ COMPLETED

**Implementation Status: COMPLETE** - All features validated with 100% test success rate.

New Features:
- Year Override: `GET /api/reports/plumber?name=Lorin&year=2024` (and `combined` endpoint) generates a report for a specified year.
- Refresh Control: `?refresh=1` forces bypass of in-memory and on-disk per-month slices.
- Per-Month Disk Cache: Stored under `backend/cache/reports/{plumber}-{year}-{month}.json`.
  - Past months treated immutable (reused indefinitely unless `refresh=1`).
  - Current month reused only if saved within `MONTH_CACHE_TTL_MS` (default 6h).
  - Env: `MONTH_CACHE_TTL_MS` can override TTL.
- Admin Year Refresh Endpoint: `POST /api/admin/refresh-year?year=2025&plumbers=Lorin,Wes`
  - Requires header: `x-admin-key: <ADMIN_KEY>` matching `.env` value `ADMIN_KEY`.
  - Forces fresh regeneration for listed plumbers (bypasses disk slices) for the target year.
  - Rate limited by `ADMIN_REFRESH_MIN_INTERVAL` minutes (default 15). Returns 429 with `retryInMinutes` if called too soon.
  - Persists timestamp at `backend/.admin-ops.json` (ignored by git).

**Validation Framework:**
- Comprehensive test suite: `node test-validation.js` in backend directory
- 6 test categories: Health, Year Override, Caching, Admin Auth, Disk Cache, Combined Endpoints
- All tests passing (100% success rate) as of 2025-09-15

File Changes Summary:
- `jobber-queries.js`: Added disk slice helpers (read/write) and year/refresh logic inside `generatePlumberReport`.
- `server.js`: Extended report endpoints to accept `year` param; added protected admin endpoint; fixed cache key functions for year-aware isolation.
- `.env`: Added `ADMIN_KEY=test-admin-key-123` and `ADMIN_REFRESH_MIN_INTERVAL=15`.
- `.gitignore`: Added `cache/` and `.admin-ops.json`.
- `test-validation.js`: Comprehensive validation script with detailed pass/fail reporting.

Operational Examples (PowerShell):
```powershell
# Year specific fetch (cached if slices exist)
curl http://localhost:3000/api/reports/plumber?name=Lorin&year=2024

# Force refresh of current year (bypass memory + disk)
curl http://localhost:3000/api/reports/plumber?name=Lorin&refresh=1

# Admin year refresh (regenerates all listed plumbers for 2025)
$headers = @{ 'x-admin-key' = 'YOUR_ADMIN_KEY' }
Invoke-RestMethod -Uri 'http://localhost:3000/api/admin/refresh-year?year=2025&plumbers=Lorin,Wes' -Method Post -Headers $headers
```

Return Metadata:
- Each monthly slice includes `cached: true|false` when reused or freshly fetched.
- Top-level report includes `meta.year`, `meta.refreshRequested`, and `meta.monthCacheTtlMs`.
- Combined endpoint `cache.year` echoes requested or default year.

Failure Responses:
- Missing admin key: 401 `{ error: 'unauthorized' }`.
- Rate limited: 429 `{ error: 'rate_limited', retryInMinutes: N }`.
- Internal error: 500 with `{ error: 'internal_error', message }`.

Maintenance Tips:
- To purge all month slices: delete `backend/cache/reports/` directory.
- To force only current month regeneration: remove that month’s JSON file.
- Avoid lowering TTL below typical API cost recovery intervals unless necessary; default is conservative.

### End Data Operations Section
