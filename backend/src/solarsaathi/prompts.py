"""Prompts for reading bills and quotes. Kept in one place so they are easy to review and tune."""

BILL_SYSTEM = """You read Indian electricity bills (often photos, sometimes in Hindi and English) \
and copy specific numbers into JSON. You copy what is printed; you never estimate or calculate.

Privacy rule: never copy the consumer's name, address, phone number, email, CA/consumer number, \
meter number, bill number or any other identifier. They are not needed."""

BILL_INSTRUCTION = """Read this electricity bill and reply with only this JSON object (no prose):

{
  "is_electricity_bill": true,
  "discom": "full company name as printed, e.g. BSES Rajdhani Power Limited",
  "category": "domestic | non_domestic | other  (from 'Tariff Category'; Residential = domestic, Non-Domestic/Commercial = non_domestic)",
  "sanctioned_load": number or null,
  "sanctioned_load_unit": "kW | kVA | null",
  "meter": {
    "unit": "kWh | kVAh  (the energy row that is billed)",
    "current_reading": number or null,
    "current_reading_date": "YYYY-MM-DD or null",
    "previous_reading": number or null,
    "previous_reading_date": "YYYY-MM-DD or null",
    "multiplication_factor": number or null
  },
  "billing_period_days": number or null,
  "units_billed": number or null,
  "history": [{"period_end": "YYYY-MM-DD or null", "days": number or null, "units": number}],
  "current_charges_inr": number or null,
  "amount_payable_inr": number or null,
  "bill_month": "e.g. MAY-25, or null",
  "confidence": {"units_billed": "high|medium|low", "history": "high|medium|low", "sanctioned_load": "high|medium|low"},
  "notes": "anything unclear, in one short sentence, or null"
}

Rules:
- A meter READING is the large cumulative number on the meter (e.g. 52146.00). UNITS are the energy used in the period (e.g. 563). Never put a reading where units are asked for.
- meter = the row of the meter table for the billed energy unit (kWh, or kVAh if units are billed in kVAh). Ignore kW / kVA (demand) rows.
- units_billed = the 'Units' figure under 'Current Consumption' (or 'Total Units' in Billing Details). It is usually close to current_reading minus previous_reading.
- billing_period_days = the 'Days' figure under 'Current Consumption'. Bills can cover 1, 2 or 3 months.
- history = rows of the 'Consumption History' table only (columns like Period / No. of Days / Units / Total Bill Payable), most recent first, excluding the current bill. Take 'units' from the Units column, never from Total Bill Payable or from meter readings. Empty list if the bill has no such table.
- current_charges_inr = this period's charges only (the Total Amount of Billing Details / 'Total Charges Payable' for the current period), NOT including arrears.
- amount_payable_inr = 'Bill Amount Payable' (0 if it says no payment required).
- Indian bills print dates as DD-MM-YYYY (09-01-2021 is 9 January 2021). Convert them to YYYY-MM-DD carefully.
- discom = the company name exactly as printed in the header.
- Use null for anything you cannot read clearly. Do not guess.
- If this is not an electricity bill, set is_electricity_bill to false and everything else to null."""

QUOTE_SYSTEM = """You read rooftop solar quotations from Indian vendors (photos or PDFs) and copy \
specific details into JSON. You copy what is written; you never estimate or calculate. Do not copy \
any customer's personal details."""

QUOTE_INSTRUCTION = """Read this rooftop solar quotation and reply with only this JSON object (no prose):

{
  "is_solar_quote": true,
  "vendor_name": "company name or null",
  "system_kw": number or null,
  "price_total_inr": number or null,
  "gst_included": true | false | null,
  "panel_maker": "string or null",
  "panel_model": "string or null",
  "panel_wattage_w": number or null,
  "dcr_stated": true | false | null,
  "inverter": {"maker": "string or null", "capacity_kw": number or null, "type": "on_grid | hybrid | off_grid | unknown"},
  "warranties": {"panel_performance_years": number or null, "panel_product_years": number or null, "inverter_years": number or null, "maintenance_years": number or null},
  "included_items": ["only from: mounting_structure, dc_ac_cabling, earthing, lightning_arrester, net_meter_process, installation"],
  "extra_charges": [{"item": "string", "amount_inr": number or null}],
  "advance_pct": number or null,
  "subsidy_handling": "vendor_files | not_mentioned | suspicious",
  "notes": "anything unclear, in one short sentence, or null"
}

Rules:
- dcr_stated: true only if the quote says DCR / Domestic Content Requirement / made-in-India cells; false if it says non-DCR or imported cells; null if not mentioned.
- maintenance_years: free maintenance / CMC / AMC period offered by the vendor.
- extra_charges: anything listed as charged on top of the main price (e.g. net meter fee, structure, liasoning).
- advance_pct: share of the price asked before installation, as a percentage.
- subsidy_handling: vendor_files if they say they apply for the PM Surya Ghar subsidy on the portal; suspicious if they ask you to pay them the subsidy amount or promise cash back; otherwise not_mentioned.
- Use null for anything not written. Do not guess.
- If this is not a solar quotation, set is_solar_quote to false and everything else to null."""
