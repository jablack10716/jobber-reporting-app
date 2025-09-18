# Charting and export functions
import os
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe
import pandas as pd
from jobber_reporting.constants import (
    BILLABLE_RATE,
    LEAD_PLUMBER_RATES,
    SUPPORT_PLUMBER_RATE,
    FIXED_OVERHEAD_RATE
)

# Professional color palette
COLORS = {
    'Lorin': {
        'main': '#445D6E',  
        'light': '#8DA3B0'  
    },
    'Wes': {
        'main': '#445D6E',  
        'light': '#8DA3B0'  
    },
    'Elijah': {
        'main': '#445D6E',  
        'light': '#8DA3B0'  
    },
    'Default': {
        'main': '#4F4F4F',  
        'light': '#939393'  
    }
}

def _save_file(filepath: str, save_func) -> None:
    """Helper function to save files and print absolute paths.
    
    Args:
        filepath: The relative filepath to save to
        save_func: Function to call with filepath to do the actual saving (e.g. plt.savefig or df.to_csv)
    """
    abs_path = os.path.abspath(filepath)
    save_func(filepath)
    print(f"✅ File saved to: {abs_path}")
from datetime import datetime

LABEL_Y_MARGIN = float(os.getenv("LABEL_Y_MARGIN", "0.15"))
PCT_LABEL_OFFSET_FRAC = float(os.getenv("PCT_LABEL_OFFSET_FRAC", "0.04"))
BAR_VALUE_OFFSET_FRAC = float(os.getenv("BAR_VALUE_OFFSET_FRAC", "0.02"))
PCT_LABEL_INSIDE_FRAC = float(os.getenv("PCT_LABEL_INSIDE_FRAC", "0.06"))

def _period_label(start_date: datetime, end_date: datetime) -> str:
    return f"{start_date.strftime('%Y-%m')}–{end_date.strftime('%Y-%m')}"

# Export functions
def generate_combined_plumber_comparison(invoice_df: pd.DataFrame, timesheet_df: pd.DataFrame,
                                     start_date: datetime, end_date: datetime):
    """Generate a combined comparison chart for all lead plumbers showing the last 3 months plus current month.
    Shows hours and profitability information for each plumber, with profit and margin shown above worked hours.
    
    Args:
        invoice_df: DataFrame with invoice data
        timesheet_df: DataFrame with timesheet entries
        start_date: Start date for the comparison
        end_date: End date for the comparison
    """
    plumbers = [
        ("Lorin", "lorin", "Lorin Sharpless"),
        ("Wes", "wes", "Wes Transier"),
        ("Elijah", "elijah", "Elijah Yanez")
    ]
    
    # Get data for each plumber and calculate profitability
    all_data = []
    for display_name, invoice_name, timesheet_name in plumbers:
        merged = _monthly_merge_for_person(
            invoice_df, timesheet_df, start_date, end_date,
            lead_plumber_label=invoice_name,
            timesheet_name_exact=timesheet_name
        )
        if not merged.empty:
            # Add profitability calculations
            lead_rate = LEAD_PLUMBER_RATES.get(display_name, 0)
            total_hourly_cost = lead_rate + SUPPORT_PLUMBER_RATE + FIXED_OVERHEAD_RATE
            merged["Revenue"] = merged["Invoiced Hours"] * BILLABLE_RATE
            merged["Total Cost"] = merged["Worked Hours"] * total_hourly_cost
            merged["Profit"] = merged["Revenue"] - merged["Total Cost"]
            merged["Profit Margin"] = (merged["Profit"] / merged["Revenue"] * 100).round(1)
            merged["Plumber"] = display_name
            all_data.append(merged)
    
    if not all_data:
        print("No data available for any plumbers in the selected period.")
        return
        
    # Combine all plumber data
    combined = pd.concat(all_data)
    
    # Create the plot with single panel
    fig, ax = plt.subplots(figsize=(15, 8))
    
    # Set y-axis limit to 0-190
    ax.set_ylim(0, 190)
    
    # Calculate bar positions
    plumbers_n = len(plumbers)
    bar_width = 0.35
    group_padding = 0.1
    group_width = bar_width * 2 + group_padding
    months = sorted(combined["Month"].unique())
    months_n = len(months)
    month_positions = np.arange(months_n) * (group_width * plumbers_n + group_padding)
    
    # Plot bars for each plumber
    for i, (display_name, _, _) in enumerate(plumbers):
        plumber_data = combined[combined["Plumber"] == display_name]
        
        # Prepare data points
        for j, month in enumerate(months):
            month_data = plumber_data[plumber_data["Month"] == month]
            if not month_data.empty:
                x_base = month_positions[j] + i * group_width
                
                # Invoiced hours bar
                invoiced = month_data["Invoiced Hours"].iloc[0]
                inv_bar = ax.bar(x_base, invoiced, bar_width, 
                               label=f"{display_name} Invoiced" if j == 0 else "",
                               color=COLORS[display_name]['light'])
                
                # Worked hours bar
                worked = month_data["Worked Hours"].iloc[0]
                work_bar = ax.bar(x_base + bar_width, worked, bar_width,
                                label=f"{display_name} Worked" if j == 0 else "",
                                color=COLORS[display_name]['main'])
                
                # Add value labels on bars
                ax.text(x_base, invoiced, f'{invoiced:.1f}', 
                       ha='center', va='bottom', fontsize=8)
                
                # Add worked hours, utilization %, and profit above the worked hours bar
                profit = month_data["Profit"].iloc[0]
                margin = month_data["Profit Margin"].iloc[0]
                
                # Calculate utilization percentage
                utilization_pct = round((invoiced / worked) * 100) if worked > 0 else 0
                
                # First line: profit amount and margin (higher up)
                ax.text(x_base + bar_width, worked + 8,
                       f'${profit:,.0f}\n({margin:.1f}% margin)', 
                       ha='center', va='bottom', fontsize=8,
                       color='tab:green' if profit > 0 else 'tab:red')
                
                # Second line: worked hours with utilization %
                ax.text(x_base + bar_width, worked + 1,
                       f'{worked:.1f}hrs ({utilization_pct}%)', 
                       ha='center', va='bottom', fontsize=8)
            
    # Customize the plot
    ax.set_ylabel("Hours")
    ax.set_title(f"Monthly Hours and Profitability by Plumber — {_period_label(start_date, end_date)}")
    
    # Set x-axis ticks at group centers
    group_centers = month_positions + (group_width * (plumbers_n - 1) / 2)
    ax.set_xticks(group_centers)
    ax.set_xticklabels([month.strftime('%Y-%m') for month in months], rotation=45, ha='right')
    ax.grid(axis='y', linestyle='--', alpha=0.7)
    ax.legend(ncol=len(plumbers), bbox_to_anchor=(0.5, -0.15), loc='upper center')
    
    # Adjust layout and save
    plt.tight_layout()
    out_file = f"combined_plumber_comparison_{start_date.strftime('%Y%m')}_{end_date.strftime('%Y%m')}.png"
    plt.savefig(out_file, dpi=150, bbox_inches="tight")
    print(f"✅ Combined comparison chart saved to {out_file}")

def export_timesheet_hours_to_csv(timesheet_df: pd.DataFrame, start_date: datetime, end_date: datetime):
    """Export timesheet hours to CSV file.
    
    Args:
        timesheet_df: DataFrame with timesheet entries
        start_date: Start date for the export
        end_date: End date for the export
    """
    if timesheet_df.empty:
        print("No timesheet data to export.")
        return

    mask = (timesheet_df["startAt"] >= pd.Timestamp(start_date)) & (timesheet_df["startAt"] <= pd.Timestamp(end_date))
    ts = timesheet_df[mask].copy()
    if ts.empty:
        print("No timesheet rows in the selected window.")
        return

    summary = ts.groupby(["ISO_Year", "ISO_Week", "Plumber"])["Hours"].sum().reset_index()
    pivot = summary.pivot_table(index=["ISO_Year", "ISO_Week"], columns="Plumber", values="Hours", fill_value=0)
    out_file = f"weekly_worked_hours_by_plumber_{start_date.strftime('%Y%m')}_{end_date.strftime('%Y%m')}.csv"
    pivot.to_csv(out_file)
    print(f"✅ Timesheet hours exported to {os.path.abspath(out_file)}")

def _monthly_merge_for_person(invoice_df: pd.DataFrame, ts_df: pd.DataFrame,
                            start_date: datetime, end_date: datetime,
                            lead_plumber_label: str, timesheet_name_exact: str) -> pd.DataFrame:
    """Merge invoice and timesheet data for a specific person.
    
    Args:
        invoice_df: DataFrame with invoice data
        ts_df: DataFrame with timesheet data
        start_date: Start date for the merge
        end_date: End date for the merge
        lead_plumber_label: Label in invoice data (e.g., "lorin")
        timesheet_name_exact: Exact name in timesheet data (e.g., "Lorin Sharpless")
        
    Returns:
        DataFrame with merged monthly data
    """
    # Invoice side (Adjusted Qty per month, excluding Job Details)
    mask_inv = (invoice_df["Date_dt"] >= pd.Timestamp(start_date.date())) & (invoice_df["Date_dt"] <= pd.Timestamp(end_date.date()))
    inv = invoice_df[mask_inv & (~invoice_df["Is Job Details"])].copy()
    inv_lp = inv[inv["Lead Plumber"].str.lower() == lead_plumber_label.lower()]
    invoiced = inv_lp.groupby("Month_Period")["Adjusted Quantity"].sum().rename("Invoiced Hours")

    # Timesheet side (Hours per month for the person)
    mask_ts = (ts_df["startAt"] >= pd.Timestamp(start_date)) & (ts_df["startAt"] <= pd.Timestamp(end_date))
    ts_person = ts_df[mask_ts & (ts_df["Plumber"].str.lower() == timesheet_name_exact.lower())].copy()
    worked = ts_person.groupby("Month_Period")["Hours"].sum().rename("Worked Hours")

    # Create a complete monthly index across the window
    month_index = pd.period_range(start=start_date, end=end_date, freq="M")
    merged = pd.concat([invoiced, worked], axis=1).reindex(month_index).fillna(0.0)
    merged.index.name = "Month"
    return merged.reset_index()

def _plot_person_monthly(merged: pd.DataFrame, person_label: str, start_date: datetime, end_date: datetime, outfile: str, active_since: datetime = None):
    """Generate a monthly comparison chart for a person.
    
    Args:
        merged: DataFrame with merged invoice/timesheet data
        person_label: Label for the chart title (e.g., "Lorin")
        start_date: Start date for the chart
        end_date: End date for the chart
        outfile: Output file path for the chart
        active_since: Optional date indicating when the person started (for partial year calculations)
    """
    if merged.empty:
        print(f"No monthly data to chart for {person_label}.")
        return

    merged = merged.copy()
    
    # First calculate profitability metrics
    lead_rate = LEAD_PLUMBER_RATES.get(person_label, 0)
    total_hourly_cost = lead_rate + SUPPORT_PLUMBER_RATE + FIXED_OVERHEAD_RATE
    merged["Revenue"] = merged["Invoiced Hours"] * BILLABLE_RATE
    merged["Total Cost"] = merged["Worked Hours"] * total_hourly_cost
    merged["Profit"] = merged["Revenue"] - merged["Total Cost"]
    merged["Profit Margin"] = (merged["Profit"] / merged["Revenue"] * 100).round(1)

    # Then calculate year-to-date totals
    if active_since:
        # For partial year employees, only sum from their start date
        active_data = merged[merged['Month'] >= pd.Period(active_since, freq='M')]
        total_source = active_data
        period_label = f"{active_since.strftime('%B')} to Present, {end_date.year}"
    else:
        total_source = merged
        period_label = str(end_date.year)

    ytd_total = {
        'Revenue': total_source['Revenue'].sum(),
        'Total Cost': total_source['Total Cost'].sum(),
        'Profit': total_source['Profit'].sum(),
        'Invoiced Hours': total_source['Invoiced Hours'].sum(),
        'Worked Hours': total_source['Worked Hours'].sum()
    }
    ytd_total['Margin'] = (ytd_total['Profit'] / ytd_total['Revenue'] * 100) if ytd_total['Revenue'] > 0 else 0
    ytd_total['Utilization'] = (ytd_total['Invoiced Hours'] / ytd_total['Worked Hours'] * 100) if ytd_total['Worked Hours'] > 0 else 0
    
    merged["MonthStr"] = merged["Month"].dt.strftime("%Y-%m")
    merged = merged.set_index("MonthStr")

    # Calculate profitability
    lead_rate = LEAD_PLUMBER_RATES.get(person_label, 0)
    total_hourly_cost = lead_rate + SUPPORT_PLUMBER_RATE + FIXED_OVERHEAD_RATE
    merged["Revenue"] = merged["Invoiced Hours"] * BILLABLE_RATE
    merged["Total Cost"] = merged["Worked Hours"] * total_hourly_cost
    merged["Profit"] = merged["Revenue"] - merged["Total Cost"]
    merged["Profit Margin"] = (merged["Profit"] / merged["Revenue"] * 100).round(1)

    # Create the plot with single panel
    fig, ax = plt.subplots(figsize=(12, 6))

    # Hours comparison
    colors = [COLORS[person_label]['light'], COLORS[person_label]['main']]
    merged[["Invoiced Hours", "Worked Hours"]].plot(kind="bar", ax=ax, width=0.75, color=colors)
    ax.margins(y=LABEL_Y_MARGIN)
    ax.set_ylim(0, 250)  # Set y-axis limit to 250
    ax.set_title(f"Monthly Hours and Profitability for {person_label} — {end_date.year}")
    ax.set_ylabel("Hours")
    ax.grid(axis='y', linestyle='--', alpha=0.7)
    ax.legend()
    
    # Add year-to-date summary box in upper right
    def format_number(num):
        if num < 0:
            return f"(${abs(num):,.0f})"
        return f"${num:,.0f}"

    summary_text = f"{period_label} Summary:\n"
    summary_text += f"Total Hours: {ytd_total['Worked Hours']:.1f} worked, {ytd_total['Invoiced Hours']:.1f} invoiced\n"
    summary_text += f"Utilization: {ytd_total['Utilization']:.1f}%\n"
    summary_text += f"Total Profit: {format_number(ytd_total['Profit'])}\n"
    summary_text += f"Profit Margin: {ytd_total['Margin']:.1f}%"
    
    ax.text(0.98, 0.98, summary_text,
            transform=ax.transAxes,
            ha='right', va='top',
            bbox=dict(boxstyle='round,pad=0.5',
                     facecolor='white',
                     edgecolor='gray',
                     alpha=0.8),
            fontsize=9)

    # Add labels for each pair of bars
    bar_positions = np.arange(len(merged))
    worked_hours = merged["Worked Hours"].values
    invoiced_hours = merged["Invoiced Hours"].values
    profits = merged["Profit"].values
    margins = merged["Profit Margin"].values

    for i, (worked, invoiced, profit, margin) in enumerate(zip(worked_hours, invoiced_hours, profits, margins)):
        # Base position for this month's bars
        x_pos = i

        # Add invoiced hours value
        if invoiced > 0:
            ax.text(x_pos - 0.19, invoiced + 1,
                   f'{invoiced:.1f}',
                   ha='center', va='bottom', fontsize=8)

        # Add worked hours value with utilization
        if worked > 0:
            utilization = round((invoiced / worked) * 100)
            ax.text(x_pos + 0.19, worked + 1,
                   f'{worked:.1f}\n({utilization}%)',
                   ha='center', va='bottom', fontsize=8)
            
            # Add profit and margin above worked hours
            profit_color = 'tab:green' if profit > 0 else 'tab:red'
            profit_text = f"${profit:,.0f}" if profit >= 0 else f"(${abs(profit):,.0f})"
            ax.text(x_pos + 0.19, worked + 25,  # Increased from +15 to +25
                   f'{profit_text}\n({margin:.1f}%)',
                   ha='center', va='bottom', fontsize=8,
                   color=profit_color)

    # Set x-axis labels
    ax.set_xticks(bar_positions)
    ax.set_xticklabels(merged.index, rotation=45, ha="right")

    # Adjust layout
    plt.tight_layout()
    
    plt.tight_layout()
    plt.savefig(outfile, dpi=150, bbox_inches="tight")
    print(f"✅ Comparison chart saved to {outfile}")

# Chart generation functions
def generate_weekly_quantity_by_plumber_chart(invoice_df: pd.DataFrame, start_date: datetime, end_date: datetime,
                                            outfile: str = None):
    """Generate a bar chart showing weekly billable hours by plumber.
    
    Args:
        invoice_df: DataFrame with invoice data
        start_date: Start date for the chart
        end_date: End date for the chart
        outfile: Optional output file path. If None, will generate a default name.
    """
    if invoice_df.empty:
        print("No data to generate weekly chart.")
        return
    
    if outfile is None:
        outfile = f"weekly_quantity_by_plumber_{start_date.strftime('%Y%m')}_{end_date.strftime('%Y%m')}.png"
        
    mask = (invoice_df["Date_dt"] >= pd.Timestamp(start_date.date())) & (invoice_df["Date_dt"] <= pd.Timestamp(end_date.date()))
    filtered = invoice_df[mask & (~invoice_df["Is Job Details"])].copy()
    if filtered.empty:
        print("No matching data in the selected window for the weekly chart.")
        return

    filtered["SortKey"] = filtered["ISO_Year"] * 100 + filtered["ISO_Week"]
    summary = (filtered.groupby(["ISO_YearWeek", "SortKey", "Lead Plumber"])["Adjusted Quantity"]
                    .sum().reset_index())
    summary = summary.sort_values("SortKey")
    pivot = summary.pivot(index="ISO_YearWeek", columns="Lead Plumber", values="Adjusted Quantity").fillna(0)

    ax = pivot.plot(kind="bar", stacked=False, figsize=(16, 6), width=0.9)
    plt.title(f"Weekly Billable Hours (Adjusted Quantity) by Lead Plumber — {_period_label(start_date, end_date)}")
    plt.xlabel("ISO Year-Week")
    plt.ylabel("Adjusted Quantity (Billable Hours)")
    plt.xticks(rotation=45, ha="right")
    plt.tight_layout()
    plt.legend(title="Lead Plumber")
    plt.grid(axis='y', linestyle='--', alpha=0.7)

    for container in ax.containers:
        for bar in container:
            height = bar.get_height()
            if height > 0:
                ax.text(bar.get_x() + bar.get_width() / 2, height + 0.5,
                        f'{height:.1f}', ha='center', va='bottom', fontsize=8)

    plt.savefig(outfile, dpi=150, bbox_inches="tight")
    print(f"✅ Weekly chart saved to {os.path.abspath(outfile)}")

def generate_monthly_invoice_summary_chart(df: pd.DataFrame, start_date: datetime, end_date: datetime,
                                        outfile: str = "monthly_invoice_summary.png") -> None:
    """Generate a monthly invoice summary chart.
    
    Args:
        df: DataFrame with invoice data
        start_date: Start date for the chart
        end_date: End date for the chart
        outfile: Output file path for the chart
    """
    if df is None or df.empty:
        print("No invoice data available for summary chart.")
        return

    # Ensure datetime + window
    if "Date_dt" not in df.columns:
        df = df.copy()
        df["Date_dt"] = pd.to_datetime(df["Date"], errors="coerce")
    mask = (df["Date_dt"] >= start_date) & (df["Date_dt"] <= end_date)
    w = df.loc[mask].copy()

    # Use one row per invoice by selecting where rollups exist
    amt_col = "Invoiced Excl. Job Details"
    qty_col = "Total Quantity Invoiced Excluding Job Details"
    if not ({amt_col, qty_col} <= set(w.columns)):
        print(f"Missing required columns: {amt_col} / {qty_col}")
        return

    rollups = w[w[amt_col].notna() & w[qty_col].notna()].copy()
    if rollups.empty:
        print("No rollup rows found to build monthly summary.")
        return

    rollups["Month"] = rollups["Date_dt"].dt.to_period("M")
    monthly = (rollups
               .groupby("Month", as_index=False)[[amt_col, qty_col]]
               .sum()
               .sort_values("Month"))

    # Per-month average (avoid div/0)
    monthly["AvgRate"] = monthly.apply(
        lambda r: (r[amt_col] / r[qty_col]) if r[qty_col] > 0 else 0.0, axis=1
    )

    # Global (rolling window) average
    total_amt = monthly[amt_col].sum()
    total_qty = monthly[qty_col].sum()
    win_avg = (total_amt / total_qty) if total_qty > 0 else 0.0

    # Plot
    fig, ax = plt.subplots(figsize=(12, 6))

    x = monthly["Month"].astype(str)  # "YYYY-MM"
    bar_color = '#4B6777'  # Professional slate blue
    ax.bar(x, monthly[amt_col], alpha=0.8, label="Total Amount Invoiced (Excl. Job Details)", 
           color=bar_color)
    ax.set_ylim(0, 70000)  # adjust as desired
    ax.set_ylabel("Total Amount Invoiced ($)", color=bar_color)
    ax.tick_params(axis='y', labelcolor=bar_color)

    # amount labels on bars + per-month average label
    for xi, v, avg in zip(x, monthly[amt_col], monthly["AvgRate"]):
        if v > 0:
            ax.text(xi, v, f"${v:,.0f}\nAvg: ${avg:,.0f}/hr",
                    ha="center", va="bottom", fontsize=9, color="navy")

    # Right axis for quantity
    ax2 = ax.twinx()
    line_color = '#787B68'  # Professional olive gray
    ax2.plot(x, monthly[qty_col], color=line_color, marker="o", linewidth=2,
             label="Total Quantity Invoiced (Excl. Job Details)")
    ax2.set_ylabel("Total Quantity Invoiced", color=line_color)
    ax2.tick_params(axis='y', labelcolor=line_color)
    ax2.set_ylim(0, 700)
    
    # quantity labels at points
    for xi, q in zip(x, monthly[qty_col]):
        ax2.text(xi, q, f"{int(round(q))}", color=line_color, fontsize=9,
                ha="center", va="bottom")

    # Title + legend
    plt.title("Monthly Invoice Summary")
    lines, labels = ax.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax.legend(lines + lines2, labels + labels2, loc="upper left")

    # Rolling 12M average callout (top-right)
    box_txt = f"{start_date.strftime('%Y-%m')} – {end_date.strftime('%Y-%m')}\n"
    box_txt += f"Rolling Avg Billable $/hr:\n${win_avg:,.2f}/hr"
    ax.text(0.98, 0.95, box_txt,
            transform=ax.transAxes, ha="right", va="top",
            bbox=dict(boxstyle="round,pad=0.4",
                     facecolor="#f5e9c9",
                     edgecolor="#bca",
                     alpha=0.9))

    ax.set_xlabel("Month")
    plt.tight_layout()
    plt.savefig(outfile, dpi=150, bbox_inches="tight")
    print(f"✅ Monthly invoice summary saved to {os.path.abspath(outfile)}")

def generate_lorin_comparison_chart(invoice_df: pd.DataFrame, timesheet_df: pd.DataFrame,
                                  start_date: datetime, end_date: datetime):
    """Generate comparison chart for Lorin."""
    merged = _monthly_merge_for_person(
        invoice_df, timesheet_df, start_date, end_date,
        lead_plumber_label="lorin",
        timesheet_name_exact="Lorin Sharpless"
    )
    out = f"lorin_invoiced_vs_worked_{start_date.strftime('%Y%m')}_{end_date.strftime('%Y%m')}.png"
    _plot_person_monthly(merged, "Lorin", start_date, end_date, out)

def generate_wes_comparison_chart(invoice_df: pd.DataFrame, timesheet_df: pd.DataFrame,
                                start_date: datetime, end_date: datetime):
    """Generate comparison chart for Wes."""
    merged = _monthly_merge_for_person(
        invoice_df, timesheet_df, start_date, end_date,
        lead_plumber_label="wes",
        timesheet_name_exact="Wes Transier"
    )
    out = f"wes_invoiced_vs_worked_{start_date.strftime('%Y%m')}_{end_date.strftime('%Y%m')}.png"
    _plot_person_monthly(merged, "Wes", start_date, end_date, out)

def generate_elijah_comparison_chart(invoice_df: pd.DataFrame, timesheet_df: pd.DataFrame,
                                   start_date: datetime, end_date: datetime):
    """Generate comparison chart for Elijah."""
    # Create a complete monthly index for the full year
    month_index = pd.period_range(start=start_date, end=end_date, freq='M')
    full_year_df = pd.DataFrame(index=month_index)
    full_year_df.index.name = "Month"
    full_year_df = full_year_df.reset_index()
    
    # Get Elijah's actual data from July onwards
    start_date_elijah = datetime(2025, 7, 1)  # Elijah's start date
    merged = _monthly_merge_for_person(
        invoice_df, timesheet_df, start_date_elijah, end_date,
        lead_plumber_label="elijah",
        timesheet_name_exact="Elijah Yanez"
    )
    
    # Merge with full year, filling earlier months with 0
    if not merged.empty:
        full_data = pd.merge(full_year_df, merged, on="Month", how="left")
        full_data = full_data.fillna(0)
    else:
        full_data = full_year_df
        full_data["Invoiced Hours"] = 0
        full_data["Worked Hours"] = 0
    
    out = f"elijah_invoiced_vs_worked_{start_date.strftime('%Y%m')}_{end_date.strftime('%Y%m')}.png"
    
    # Use special flag for Elijah to only calculate totals from July
    _plot_person_monthly(full_data, "Elijah", start_date, end_date, out, active_since=start_date_elijah)


