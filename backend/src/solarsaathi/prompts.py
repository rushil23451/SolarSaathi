"""Prompts for reading bills and quotes. Kept in one place so they are easy to review and tune."""

BILL_SYSTEM = """You read Indian electricity bills (often photos, sometimes in Hindi and English) \
and copy specific numbers into JSON. You copy what is printed; you never estimate or calculate.

Privacy rule: never copy the consumer's name, address, phone number, email, CA/consumer number, \
meter number, bill number or any other identifier. They are not needed."""

BILL_INSTRUCTION = """Read this electricity bill. Most bills are from Delhi discoms (BSES Rajdhani, BSES Yamuna,
Tata Power-DDL) and share one layout:

1. Top block: "Sanctioned Load : 4.00 (kW)" (sometimes kVA), "Tariff Category : Domestic [Residential]",
   "Bill Month : MAY-25".
2. Middle table, headed "Billed Consumption (Current)" / "Billed Consumption (Previous)" /
   "Multiplication Factor" / "Current Consumption (Days, Unit)". It has one row per meter register
   (kWh, kVAh, kW). Use the row of the register that is billed: the "Billing Details" table below it shows
   "Energy Units Consumed / Billed" and "Total Units"; whichever row's units match that is the billed one
   (homes are usually billed in kWh, shops and offices often in kVAh). Columns, left to right:
   Meter No | Unit | current Date of Meter Reading | current Reading | previous Date of Meter Reading |
   previous Reading | Multiplication Factor | Days | Unit (the units consumed).
3. Lower table "Consumption History": one row per past bill with columns
   Period From | Period To | No. of Days | Units (kWh/kVAh) | Total Bill Payable | Bill Basis.

Work through the bill in that order, copying digits exactly, then reply with only this JSON (no prose):

{
  "is_electricity_bill": true,
  "discom": "company name as printed in the header",
  "category": "domestic | non_domestic | other",
  "sanctioned_load": number or null,
  "sanctioned_load_unit": "kW | kVA | null",
  "bill_month": "e.g. MAY-25, or null",
  "meter": {
    "unit": "kWh | kVAh",
    "current_reading_date": "YYYY-MM-DD or null",
    "current_reading": number or null,
    "previous_reading_date": "YYYY-MM-DD or null",
    "previous_reading": number or null,
    "multiplication_factor": number or null,
    "days": number or null,
    "units": number or null
  },
  "billing_period_days": number or null,
  "units_billed": number or null,
  "billing_total_units": "the Total Units value printed in the Billing Details table, number or null",
  "history": [
    {"period_start": "YYYY-MM-DD", "period_end": "YYYY-MM-DD", "days": number, "units": number, "bill_amount": number or null}
  ],
  "current_charges_inr": number or null,
  "amount_payable_inr": number or null,
  "confidence": {"units_billed": "high|medium|low", "history": "high|medium|low", "sanctioned_load": "high|medium|low"},
  "notes": "anything unclear, in one short sentence, or null"
}

Rules:
- units_billed is the billed energy: "Total Units" / "Energy Units Consumed/Billed" in Billing Details, which
  equals the "Unit" cell of the billed row of the middle table. billing_period_days is that row's "Days" cell
  (if the column is cut off, leave it null; we work it out from the reading dates). Units are usually 50 to 3000. A reading is
  the large cumulative number on the meter (like 52146.00): never put a reading in units.
- history: copy EVERY row of the Consumption History table, top to bottom, in order. "units" comes from the
  Units column; "bill_amount" from the Total Bill Payable column (it has decimals like 2170.00). Never swap
  them. Do not include the current bill. Empty list if there is no such table.
- Dates on Indian bills are DD-MM-YYYY (25-04-2025 is 25 April 2025). Convert carefully to YYYY-MM-DD.
- category: Domestic / Residential = domestic; Non-Domestic / Commercial = non_domestic.
- current_charges_inr: this period's charges only, without arrears. amount_payable_inr: "Bill Amount Payable".
- Never copy names, addresses, phone numbers, CA/consumer numbers, meter numbers or bill numbers.
- Use null for anything you cannot read clearly. Do not guess.
- If this is not an electricity bill, set is_electricity_bill to false and everything else to null."""

BILL_ZOOM_NOTE = """

You are given two images of the same page: the whole bill, then a zoomed-in copy of its lower part.
Read the Consumption History table (and anything else small) from the zoomed image."""

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
