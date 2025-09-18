# Main script orchestration
from datetime import datetime, timedelta
import os
from jobber_reporting.auth import TokenManager
from jobber_reporting.data_fetch import (
    upsert_invoices_csv,
    upsert_timesheets_csv
)
from jobber_reporting.reporting import (
    generate_monthly_invoice_summary_chart,
    generate_lorin_comparison_chart,
    generate_wes_comparison_chart,
    generate_elijah_comparison_chart,
    generate_combined_plumber_comparison,  # Keep imported but won't use
    export_timesheet_hours_to_csv
)

def main():
    print("Starting script...")
    token_mgr = TokenManager()
    print("Token manager initialized.")

    # Set up date ranges
    end_date = datetime.now()
    calendar_start = datetime(end_date.year, 1, 1)  # January 1st of current year
    rolling_12_start = end_date - timedelta(days=365)  # Rolling 12 months for invoice summary
    
    # Use incremental refresh for both invoice and timesheet data
    print("Updating invoice data...")
    invoice_df, _ = upsert_invoices_csv(token_mgr, end_date)
    print(f"Invoice data updated through {end_date.strftime('%Y-%m-%d')}")

    print("Updating timesheet data...")
    timesheet_df, _ = upsert_timesheets_csv(token_mgr, end_date)
    print("Timesheet data updated.")

    # Create output directory if it doesn't exist
    output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports")
    os.makedirs(output_dir, exist_ok=True)
    os.chdir(output_dir)

    # Generate all reports
    print("\nGenerating reports...")

    # 1. Monthly invoice summary (rolling 12 months)
    print("Generating monthly invoice summary...")
    generate_monthly_invoice_summary_chart(invoice_df, rolling_12_start, end_date)

    # 2. Individual plumber comparisons (calendar year)
    print("Generating plumber comparison charts...")
    generate_lorin_comparison_chart(invoice_df, timesheet_df, calendar_start, end_date)
    generate_wes_comparison_chart(invoice_df, timesheet_df, calendar_start, end_date)
    generate_elijah_comparison_chart(invoice_df, timesheet_df, calendar_start, end_date)

    # Note: Combined plumber comparison is disabled but code kept for reference
    # print("Generating combined plumber comparison chart...")
    # three_month_start = end_date.replace(day=1) - timedelta(days=90)
    # generate_combined_plumber_comparison(invoice_df, timesheet_df, three_month_start, end_date)

    # 3. Export timesheet data (calendar year)
    print("Exporting timesheet data...")
    export_timesheet_hours_to_csv(timesheet_df, calendar_start, end_date)

    print("\nAll reports generated successfully!")
    print(f"Reports can be found in: {os.path.abspath(output_dir)}")

if __name__ == "__main__":
    main()
