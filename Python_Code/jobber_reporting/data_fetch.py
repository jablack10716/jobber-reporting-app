# Data fetching and processing (invoices, timesheets)
import os
import pandas as pd
from datetime import datetime, timedelta
import time
from .api import call_graphql

# Constants for file paths and refresh settings
INVOICES_CSV = os.getenv(
    "INVOICES_CSV",
    r"C:\Users\jabla\OneDrive\Documents\Advanced\Python\invoice_data_with_lead_plumber.csv"
)
TIMESHEETS_CSV = os.getenv(
    "TIMESHEETS_CSV",
    r"C:\Users\jabla\OneDrive\Documents\Advanced\Python\timesheet_entries.csv"
)
REFRESH_DAYS = int(os.getenv("REFRESH_DAYS", "30"))

def _recompute_invoice_derived_cols(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure types/derived columns are correct after CSV roundtrips."""
    df = df.copy()
    df["Date_dt"] = pd.to_datetime(df["Date"])
    iso = df["Date_dt"].dt.isocalendar()
    df["ISO_Year"] = iso.year.astype(int)
    df["ISO_Week"] = iso.week.astype(int)
    df["ISO_YearWeek"] = df["ISO_Year"].astype(str) + "-W" + df["ISO_Week"].astype(str).str.zfill(2)
    df["Month_Period"] = df["Date_dt"].dt.to_period("M")
    if df["Is Job Details"].dtype != bool:
        df["Is Job Details"] = (
            df["Is Job Details"].astype(str).str.lower()
            .map({"true": True, "false": False})
            .fillna(False).astype(bool)
        )
    return df

def _recompute_timesheet_derived_cols(ts: pd.DataFrame) -> pd.DataFrame:
    """Ensure dtypes and derived columns are correct after CSV roundtrips."""
    ts = ts.copy()
    ts["startAt"] = pd.to_datetime(ts["startAt"], errors="coerce")
    if "Plumber" not in ts.columns and {"firstName", "lastName"}.issubset(ts.columns):
        ts["Plumber"] = (ts["firstName"].fillna("") + " " + ts["lastName"].fillna("")).str.strip()
    iso = ts["startAt"].dt.isocalendar()
    ts["ISO_Year"] = iso.year.astype(int)
    ts["ISO_Week"] = iso.week.astype(int)
    ts["ISO_YearWeek"] = ts["ISO_Year"].astype(str) + "-W" + ts["ISO_Week"].astype(str).str.zfill(2)
    ts["Month_Period"] = ts["startAt"].dt.to_period("M")
    if "Hours" not in ts.columns and "finalDuration" in ts.columns:
        ts["Hours"] = ts["finalDuration"].fillna(0) / 3600.0
    return ts

def upsert_invoices_csv(token_mgr, end_date: datetime) -> tuple[pd.DataFrame, datetime]:
    """Incremental refresh of invoice data.
    
    If INVOICES_CSV exists:
    - Keep rows older than refresh_start
    - Re-fetch [refresh_start..end_date]
    Else:
    - Fetch full rolling 12 months
    
    Returns:
        Tuple of (updated_df, window_start)
    """
    window_start = end_date - timedelta(days=365)
    refresh_start = end_date - timedelta(days=REFRESH_DAYS)

    if os.path.exists(INVOICES_CSV):
        print(f"🔄 Incremental refresh: using {INVOICES_CSV} and updating last {REFRESH_DAYS} days...")
        existing = pd.read_csv(INVOICES_CSV)
        if "Date" not in existing.columns:
            raise RuntimeError(f"{INVOICES_CSV} is missing 'Date' column.")
        existing["Date_dt"] = pd.to_datetime(existing["Date"])
        head = existing[existing["Date_dt"] < refresh_start.replace(hour=0, minute=0, second=0, microsecond=0)]
        fetch_start = max(refresh_start, window_start)
        tail = fetch_and_process_data_range(token_mgr, fetch_start, end_date)
        updated = pd.concat([head, tail], ignore_index=True)
    else:
        print(f"🆕 Seeding invoices CSV with full 12-month window into {INVOICES_CSV} ...")
        updated = fetch_and_process_data_range(token_mgr, window_start, end_date)

    updated = _recompute_invoice_derived_cols(updated)
    mask = (updated["Date_dt"] >= window_start) & (updated["Date_dt"] <= end_date)
    updated = updated.loc[mask].copy()

    sort_cols = [c for c in ["Date_dt", "Invoice Number", "Description"] if c in updated.columns]
    if sort_cols:
        updated.sort_values(sort_cols, inplace=True)

    updated.to_csv(INVOICES_CSV, index=False)
    print(f"✅ Invoices saved to {INVOICES_CSV} (rows: {len(updated)})")
    return updated, window_start

def upsert_timesheets_csv(token_mgr, end_date: datetime) -> tuple[pd.DataFrame, datetime]:
    """Incremental refresh of timesheet entries.
    
    If TIMESHEETS_CSV exists:
    - Keep rows older than refresh_start
    - Re-fetch [refresh_start..end_date]
    Else:
    - Fetch full rolling 12 months
    
    Returns:
        Tuple of (updated_df, window_start)
    """
    window_start = end_date - timedelta(days=365)
    refresh_start = end_date - timedelta(days=REFRESH_DAYS)

    if os.path.exists(TIMESHEETS_CSV):
        print(f"🔄 Incremental refresh: using {TIMESHEETS_CSV} and updating last {REFRESH_DAYS} days...")
        existing = pd.read_csv(TIMESHEETS_CSV)
        if "startAt" not in existing.columns:
            raise RuntimeError(f"{TIMESHEETS_CSV} is missing 'startAt' column.")
        existing["startAt"] = pd.to_datetime(existing["startAt"], errors="coerce")

        cutoff = refresh_start.replace(hour=0, minute=0, second=0, microsecond=0)
        head = existing[existing["startAt"] < cutoff]

        fetch_start = max(refresh_start, window_start)
        tail = fetch_timesheets_range(token_mgr, fetch_start, end_date)

        updated = pd.concat([head, tail], ignore_index=True)
        updated.dropna(subset=["startAt"], inplace=True)
        updated.sort_values("startAt", inplace=True)
        updated.drop_duplicates(subset=["firstName", "lastName", "startAt", "finalDuration"], 
                              keep="last", inplace=True)
    else:
        print(f"🆕 Seeding timesheets CSV with full 12-month window into {TIMESHEETS_CSV} ...")
        updated = fetch_timesheets_range(token_mgr, window_start, end_date)

    updated = _recompute_timesheet_derived_cols(updated)
    mask = (updated["startAt"] >= window_start) & (updated["startAt"] <= end_date)
    updated = updated.loc[mask].copy()

    updated.sort_values("startAt", inplace=True)
    updated.to_csv(TIMESHEETS_CSV, index=False)
    print(f"✅ Timesheets saved to {TIMESHEETS_CSV} (rows: {len(updated)})")
    return updated, window_start

def fetch_timesheets_range(token_mgr, start_date: datetime, end_date: datetime) -> pd.DataFrame:
    """Fetch timesheet entries for the given date range.
    
    Args:
        token_mgr: The TokenManager instance
        start_date: Start date for fetching entries
        end_date: End date for fetching entries
        
    Returns:
        DataFrame with timesheet entries
    """
    all_entries = []
    cursor = None
    query = f"""
    query($after: String) {{
      timeSheetEntries(first: 50, after: $after, filter: {{
        startAt: {{ after: "{start_date.strftime('%Y-%m-%d')}", before: "{end_date.strftime('%Y-%m-%d')}" }}
      }}) {{
        edges {{
          node {{
            user {{ name {{ first last }} }}
            finalDuration
            startAt
          }}
        }}
        pageInfo {{ endCursor hasNextPage }}
      }}
    }}
    """

    while True:
        variables = {"after": cursor} if cursor else {}
        data = call_graphql(token_mgr, query, variables)
        edges = data["data"]["timeSheetEntries"]["edges"]
        for entry in edges:
            node = entry["node"]
            user = node.get("user", {}) or {}
            name = user.get("name", {}) or {}
            all_entries.append({
                "firstName": name.get("first", "Unknown") or "Unknown",
                "lastName": name.get("last", "Unknown") or "Unknown",
                "startAt": node.get("startAt"),
                "finalDuration": node.get("finalDuration", 0) or 0
            })
        page_info = data["data"]["timeSheetEntries"]["pageInfo"]
        if not page_info["hasNextPage"]:
            break
        cursor = page_info["endCursor"]
        time.sleep(2)

    ts = pd.DataFrame(all_entries)
    if not ts.empty:
        # Parse as UTC, then drop timezone so comparisons to naive start/end work cleanly
        ts["startAt"] = pd.to_datetime(ts["startAt"], utc=True).dt.tz_localize(None)

        iso = ts["startAt"].dt.isocalendar()
        ts["ISO_Year"] = iso.year.astype(int)
        ts["ISO_Week"] = iso.week.astype(int)
        ts["ISO_YearWeek"] = ts["ISO_Year"].astype(str) + "-W" + ts["ISO_Week"].astype(str).str.zfill(2)
        ts["Month_Period"] = ts["startAt"].dt.to_period("M")
        ts["Plumber"] = ts["firstName"] + " " + ts["lastName"]
        ts["Hours"] = ts["finalDuration"] / 3600
    return ts

def build_invoice_query(start_date: str, end_date: str) -> str:
    return f"""
    query($after: String, $invFirst: Int!, $liFirst: Int!) {{
      invoices(first: $invFirst, after: $after, filter: {{
        createdAt: {{ after: \"{start_date}\", before: \"{end_date}\" }}
      }}) {{
        edges {{
          node {{
            invoiceNumber
            createdAt
            total
            paymentsTotal
            client {{
              id
              firstName
              lastName
              companyName
            }}
            customFields {{
              ... on CustomFieldDropdown {{ label valueDropdown }}
              ... on CustomFieldText {{ label valueText }}
            }}
            lineItems(first: $liFirst) {{
              edges {{
                node {{
                  description
                  quantity
                  unitPrice
                  linkedProductOrService {{ id name }}
                }}
              }}
            }}
          }}
        }}
        pageInfo {{ endCursor hasNextPage }}
      }}
    }}
    """

def fetch_and_process_data_range(token_mgr, start_date: datetime, end_date: datetime) -> pd.DataFrame:
    def _cf_value(fields, label):
        for f in fields or []:
            if f.get("label") == label:
                return f.get("valueDropdown") or f.get("valueText")
        return None
    all_invoices = []
    cursor = None
    query = build_invoice_query(start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
    inv_first = 5
    li_first = 20
    import time
    while True:
        variables = {"after": cursor, "invFirst": inv_first, "liFirst": li_first} if cursor else {
            "invFirst": inv_first, "liFirst": li_first
        }
        data = call_graphql(token_mgr, query, variables)
        invoices = data["data"]["invoices"]["edges"]
        all_invoices.extend(invoices)
        page_info = data["data"]["invoices"]["pageInfo"]
        if not page_info["hasNextPage"]:
            break
        cursor = page_info["endCursor"]
        time.sleep(5)
    data_list = []
    for invoice in all_invoices:
        node = invoice["node"]
        created_at = datetime.strptime(node["createdAt"], "%Y-%m-%dT%H:%M:%SZ")
        invoice_number = node["invoiceNumber"]
        invoice_total = node["total"]
        payments_total = node["paymentsTotal"]
        iso_cal = created_at.isocalendar()
        iso_year, iso_week = int(iso_cal.year), int(iso_cal.week)
        client = (node.get("client") or {})
        customer_name = (
            (client.get("companyName") or "").strip()
            or " ".join(x for x in [(client.get("firstName") or "").strip(),
                                    (client.get("lastName") or "").strip()] if x)
            or "Unknown"
        )
        cf = node.get("customFields", [])
        lead_plumber_1 = (_cf_value(cf, "Lead Plumber") or "Unknown").strip()
        lead_plumber_2 = (_cf_value(cf, "Lead Plumber 2") or "").strip()
        lp1_norm = lead_plumber_1.lower()
        lp2_norm = lead_plumber_2.lower()
        two_leads = bool(lead_plumber_1) and bool(lead_plumber_2) and (lp1_norm != lp2_norm)
        invoice_total_qty = 0
        invoice_total_qty_excl = 0
        non_job_details_total = 0
        first_line_index = len(data_list)
        for edge in node["lineItems"]["edges"]:
            line_node = edge["node"]
            desc = (line_node.get("description") or "").strip()
            qty = line_node.get("quantity", 0) or 0
            price = line_node.get("unitPrice", 0) or 0
            line_total = qty * price
            product_or_service = line_node.get("linkedProductOrService") or {}
            name = product_or_service.get("name") or ""
            is_job_details = name == "Job Details"
            is_credit_card_fee = (desc == "Credit Card Service Fee") or (name == "Credit Card Service Fee")
            is_excavation = (desc == "Excavation") or (name == "Excavation")
            adjusted_qty = (qty * 8) if is_excavation else qty
            if not is_job_details and not is_credit_card_fee:
                non_job_details_total += line_total
                invoice_total_qty_excl += adjusted_qty
            invoice_total_qty += qty
            recipients = [lead_plumber_1] if not two_leads else [lead_plumber_1, lead_plumber_2]
            split_factor = 1.0 if len(recipients) == 1 else 0.5
            for lp in recipients:
                data_list.append({
                    "Invoice Number": invoice_number,
                    "Date": created_at.strftime("%Y-%m-%d"),
                    "Customer": customer_name,
                    "Lead Plumber": lp if lp else "Unknown",
                    "Lead Plumber 2": lead_plumber_2 if lead_plumber_2 else "",
                    "ISO_Year": iso_year,
                    "ISO_Week": iso_week,
                    "ISO_YearWeek": f"{iso_year}-W{iso_week:02d}",
                    "Description": desc,
                    "Quantity": qty,
                    "Adjusted Quantity": adjusted_qty * split_factor,
                    "Unit Price": price,
                    "Line Total": line_total,
                    "Is Job Details": is_job_details,
                    "Invoice Total": invoice_total,
                    "Payments Total": payments_total,
                })
        if len(data_list) > first_line_index:
            data_list[first_line_index]["Invoiced Excl. Job Details"] = non_job_details_total
            data_list[first_line_index]["Total Quantity Invoiced"] = invoice_total_qty
            data_list[first_line_index]["Total Quantity Invoiced Excluding Job Details"] = invoice_total_qty_excl
    df = pd.DataFrame(data_list)
    if not df.empty:
        df["Date_dt"] = pd.to_datetime(df["Date"])
        df["Month_Period"] = df["Date_dt"].dt.to_period("M")
    return df
