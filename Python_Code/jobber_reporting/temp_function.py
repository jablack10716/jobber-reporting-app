def generate_combined_plumber_comparison(invoice_df: pd.DataFrame, timesheet_df: pd.DataFrame,
                                     start_date: datetime, end_date: datetime):
    """Generate a combined comparison chart for all lead plumbers showing the last 3 months plus current month.
    
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
    
    # Create the plot with wider figure for multiple plumbers and profitability subplot
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(15, 12), height_ratios=[2, 1])
    
    # Calculate bar positions
    plumbers_n = len(plumbers)
    bar_width = 0.35
    group_padding = 0.1
    group_width = bar_width * 2 + group_padding
    months = sorted(combined["Month"].unique())
    months_n = len(months)
    month_positions = np.arange(months_n) * (group_width * plumbers_n + group_padding)
    
    # Plot hours comparison bars
    for i, (display_name, _, _) in enumerate(plumbers):
        plumber_data = combined[combined["Plumber"] == display_name]
        
        # Prepare data points
        for j, month in enumerate(months):
            month_data = plumber_data[plumber_data["Month"] == month]
            if not month_data.empty:
                x_base = month_positions[j] + i * group_width
                
                # Invoiced hours bar
                invoiced = month_data["Invoiced Hours"].iloc[0]
                inv_bar = ax1.bar(x_base, invoiced, bar_width, 
                                label=f"{display_name} Invoiced" if j == 0 else "",
                                color=f"C{i}", alpha=0.6)
                
                # Worked hours bar
                worked = month_data["Worked Hours"].iloc[0]
                work_bar = ax1.bar(x_base + bar_width, worked, bar_width,
                                 label=f"{display_name} Worked" if j == 0 else "",
                                 color=f"C{i}", alpha=1.0)
                
                # Add value labels on bars
                ax1.text(x_base, invoiced, f'{invoiced:.1f}', 
                        ha='center', va='bottom', fontsize=8)
                ax1.text(x_base + bar_width, worked, f'{worked:.1f}',
                        ha='center', va='bottom', fontsize=8)
                
                # Add utilization percentage
                if worked > 0:
                    pct = round((invoiced / worked) * 100)
                    inside_off = max(0.5, worked * PCT_LABEL_INSIDE_FRAC)
                    ax1.text(x_base + bar_width/2, worked - inside_off,
                           f"{pct}%", ha='center', va='top',
                           fontsize=10, fontweight='bold', color='white',
                           path_effects=[pe.withStroke(linewidth=2, foreground="black")])
    
    # Customize the upper plot
    ax1.set_ylabel("Hours")
    ax1.set_title(f"Monthly Hours and Profitability by Plumber — {_period_label(start_date, end_date)}")
    
    # Set x-axis ticks at group centers for upper plot
    group_centers = month_positions + (group_width * (plumbers_n - 1) / 2)
    ax1.set_xticks(group_centers)
    ax1.set_xticklabels([month.strftime('%Y-%m') for month in months], rotation=45, ha='right')
    ax1.grid(axis='y', linestyle='--', alpha=0.7)
    ax1.legend(ncol=len(plumbers), bbox_to_anchor=(0.5, -0.15), loc='upper center')
    
    # Lower plot: Profit and margin comparison
    for i, (display_name, _, _) in enumerate(plumbers):
        plumber_data = combined[combined["Plumber"] == display_name]
        if not plumber_data.empty:
            # Plot profit bars
            x = range(len(months))
            profits = plumber_data["Profit"].values
            margins = plumber_data["Profit Margin"].values
            
            # Plot profit bars on left y-axis
            profit_bars = ax2.bar([xi + i*0.25 for xi in x], profits, width=0.2, alpha=0.6, 
                                color=f"C{i}", label=f"{display_name} Profit")
            
            # Add profit values above bars
            for xi, profit in zip([xi + i*0.25 for xi in x], profits):
                ax2.text(xi, profit, f'${profit:,.0f}', ha='center', va='bottom', 
                        fontsize=8, color=f"C{i}")
            
            # Plot margin line on right y-axis
            ax3 = ax2.twinx()
            line = ax3.plot(x, margins, '-o', color=f"C{i}", alpha=0.8,
                          label=f"{display_name} Margin")
            
            # Add margin labels above points
            for xi, margin in zip(x, margins):
                ax3.text(xi, margin, f'{margin:.1f}%',
                        ha='center', va='bottom', fontsize=8,
                        color=f"C{i}")
    
    # Customize lower plot
    ax2.set_ylabel("Profit ($)", color='tab:blue')
    ax2.tick_params(axis='y', labelcolor='tab:blue')
    ax2.grid(axis='y', linestyle='--', alpha=0.7)
    
    ax3.set_ylabel("Profit Margin (%)", color='tab:red')
    ax3.tick_params(axis='y', labelcolor='tab:red')
    
    # Set x-axis labels for lower plot
    ax2.set_xticks(range(len(months)))
    ax2.set_xticklabels([m.strftime('%Y-%m') for m in months], rotation=45, ha='right')
    
    # Combine legends for profit and margin
    lines1, labels1 = ax2.get_legend_handles_labels()
    lines2, labels2 = ax3.get_legend_handles_labels()
    ax2.legend(lines1 + lines2, labels1 + labels2, 
              loc='upper right', ncol=len(plumbers))
    
    # Adjust layout and save
    plt.tight_layout()
    out_file = f"combined_plumber_comparison_{start_date.strftime('%Y%m')}_{end_date.strftime('%Y%m')}.png"
    plt.savefig(out_file, dpi=150, bbox_inches="tight")
    print(f"✅ Combined comparison chart saved to {out_file}")
