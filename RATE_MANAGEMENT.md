# Production Rate Management Guide

## Overview
The Jobber Reporting App now supports flexible business rate management through environment variables, allowing rate updates without code changes.

## Current Rate Structure

### Business Rates (as of 2025-09-16)
- **Billable Rate**: $165.00/hour (revenue rate for time worked)
- **Support Plumber Rate**: $16.70/hour (cost for support plumbers)
- **Fixed Overhead Rate**: $18.07/hour (fixed costs per hour)

### Lead Plumber Rates (hourly costs)
- **Wes**: $34.85/hour
- **Lorin**: $24.76/hour
- **Elijah**: $23.78/hour

## Environment Variable Configuration

### Production Rate Updates
Update rates by setting environment variables before starting the server:

```powershell
# Windows PowerShell - Individual rate updates
$env:BILLABLE_RATE='175.0'
$env:LEAD_PLUMBER_RATE_LORIN='25.50'
$env:SUPPORT_PLUMBER_RATE='17.00'
$env:FIXED_OVERHEAD_RATE='18.50'

# Start server with new rates
cd 'c:\Users\jabla\OneDrive\Documents\Advanced\Python\jobber-reporting-app\backend'
node server.js
```

### Available Environment Variables
```bash
# Revenue Rates
BILLABLE_RATE=165.0                    # Hourly billing rate

# Cost Rates - Lead Plumbers
LEAD_PLUMBER_RATE_WES=34.85           # Wes hourly cost
LEAD_PLUMBER_RATE_LORIN=24.76         # Lorin hourly cost  
LEAD_PLUMBER_RATE_ELIJAH=23.78        # Elijah hourly cost

# Cost Rates - Other
SUPPORT_PLUMBER_RATE=16.70            # Support plumber hourly cost
FIXED_OVERHEAD_RATE=18.07             # Fixed overhead per hour
```

## Fallback System
- **Environment Variables**: Take priority when set
- **`.env` File**: Used as fallback for unset variables
- **Hard-coded Defaults**: Final fallback in `backend/jobber-queries.js`

## Rate Verification
The server logs current rates on startup:
```
[JOBBER-QUERIES] Current business rates: {
  billableRate: 175,
  supportPlumberRate: 16.7,
  fixedOverheadRate: 18.07,
  leadPlumberRates: { Wes: 34.85, Lorin: 25.5, Elijah: 23.78 }
}
```

## Production Deployment Workflow

### 1. Testing Rate Changes
```powershell
# Test with temporary environment variables
$env:BILLABLE_RATE='175.0'
$env:LEAD_PLUMBER_RATE_LORIN='25.50'
cd 'c:\Users\jabla\OneDrive\Documents\Advanced\Python\jobber-reporting-app\backend'
node server.js

# Verify rates in startup logs
# Test reports: curl "http://localhost:3000/api/reports/plumber?name=Lorin"
```

### 2. Permanent Rate Updates
```powershell
# Option A: Update .env file directly (persistent across restarts)
# Edit backend/.env and modify rate values

# Option B: Set system environment variables (Windows)
# setx BILLABLE_RATE "175.0"
# setx LEAD_PLUMBER_RATE_LORIN "25.50"

# Option C: Process manager (PM2, Docker, etc.)
# Set environment variables in deployment configuration
```

### 3. Validation Steps
1. **Check Startup Logs**: Verify rates loaded correctly
2. **Test Report Calculation**: Generate sample report to confirm rate impact
3. **Cache Refresh**: Use `?refresh=1` to bypass cached data for immediate effect
4. **Backup Previous Rates**: Document rate changes for audit trail

## Rate Impact on Calculations

### Revenue Calculation
```
Revenue = BILLABLE_RATE × Total Hours Worked
```

### Cost Calculation (Lead Plumbers)
```
Labor Cost = LEAD_PLUMBER_RATE × Hours Worked
Fixed Overhead = FIXED_OVERHEAD_RATE × Hours Worked
Total Cost = Labor Cost + Fixed Overhead
```

### Cost Calculation (Support Plumbers)
```
Labor Cost = SUPPORT_PLUMBER_RATE × Hours Worked
Fixed Overhead = FIXED_OVERHEAD_RATE × Hours Worked
Total Cost = Labor Cost + Fixed Overhead
```

### Profit Calculation
```
Profit = Revenue - Total Cost
Profit Margin = (Profit / Revenue) × 100%
```

## Important Notes

### Cache Considerations
- **Cached Reports**: May show old rates until cache expires or is refreshed
- **Force Refresh**: Use `?refresh=1` parameter for immediate rate change impact
- **Cache TTL**: Monthly reports cache for 6 hours (current month) or indefinitely (past months)

### Rate Change Impact
- **Historical Data**: Past reports maintain original calculation rates unless refreshed
- **Current Reports**: New rates apply immediately to fresh calculations
- **Data Consistency**: Consider rate change documentation for audit purposes

### Validation Rules
- All rates must be positive numbers
- Rates are parsed as floats (decimal values supported)
- Invalid values fallback to defaults
- Zero values are allowed but may cause unexpected calculations

## Troubleshooting

### Common Issues
1. **Rates Not Updating**: Check environment variable names match exactly
2. **Calculation Errors**: Verify rate values are numeric and positive
3. **Cache Showing Old Data**: Use `?refresh=1` to bypass cache
4. **Server Won't Start**: Check for syntax errors in `.env` file

### Debug Commands
```powershell
# Check current environment variables
Get-ChildItem Env: | Where-Object {$_.Name -like "*RATE*"}

# Verify server startup logs
cd 'backend' && node server.js

# Test specific plumber calculation
curl "http://localhost:3000/api/reports/plumber?name=Lorin&refresh=1"
```

## Future Enhancements

### Planned Features
- **Admin API**: REST endpoints for rate updates without server restart
- **Rate History**: Track rate changes over time
- **Validation API**: Verify rate changes before applying
- **Database Storage**: Move rates to database for multi-user systems

### Advanced Options
- **Role-based Rates**: Different rates per job type or client
- **Time-based Rates**: Seasonal or promotional rate adjustments
- **Automated Rate Updates**: Integration with external pricing systems
- **Rate Change Notifications**: Alert system for rate modifications

## Security Considerations
- **Environment Variables**: Keep production rates secure
- **Access Control**: Limit who can modify rate configurations
- **Audit Trail**: Log rate changes for compliance
- **Backup Strategy**: Maintain rate configuration backups

---

**Last Updated**: 2025-09-16  
**Version**: 1.0.0  
**System**: Jobber Reporting App - Production Rate Management