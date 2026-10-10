// Plain-language explanations for every number on the result screen, in English and Hindi.
// Each function takes the analysis result `r` from the backend; nothing here calculates money,
// it only puts the backend's numbers into words.
import { inr } from "./i18n.js";

const n = (x, d = 0) => Number(x || 0).toLocaleString("en-IN", { maximumFractionDigits: d });
const lakh = (x) => (Math.abs(x) >= 100000 ? `₹${n(x / 100000, 2)} lakh` : inr(x));
const lakhHi = (x) => (Math.abs(x) >= 100000 ? `₹${n(x / 100000, 2)} लाख` : inr(x));

export const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  hi: ["जन", "फ़र", "मार्च", "अप्रै", "मई", "जून", "जुल", "अग", "सित", "अक्टू", "नव", "दिस"],
};

const LIMIT = {
  en: { need: "what you use", sanctioned_load: "your sanctioned load", roof: "your roof space" },
  hi: { need: "आपकी खपत", sanctioned_load: "आपका स्वीकृत लोड", roof: "आपकी छत" },
};

export const EXPLAIN = {
  en: {
    coverageTitle: "How much of your electricity solar makes",
    coverage: (r) => `Solar covers ${r.coverage_pct}% of your use. It makes about ${n(r.solar_units_month)} of your ${n(r.monthly_units)} units a month; about ${n(r.grid_units_month)} units still come from the grid.`,
    solar: "From your roof", grid: "From the grid",

    sizeTitle: "Recommended system",
    sizeValue: (r) => `${r.system_kw} kW`,
    sizeSub: (r) => `${r.size.panels} panels · about ${n(r.size.roof_sqft)} sq ft of shadow-free roof`,
    sizeWhy: (r) => `Sized to cover about ${r.size.coverage_target_pct}% of what you use, limited by ${LIMIT.en[r.size.limited_by]}.`,
    sizeRows: (r) => [
      ["Your average use", `${n(r.monthly_units)} units/month`],
      ["What 1 kW of panels makes here", `${n(r.size.yield_per_kw_year)} units/year (${n(r.size.yield_per_kw_year / 12)}/month)`],
      [`Size to cover ${r.size.coverage_target_pct}% of your use`, `${r.size.needed_kw} kW`],
      ...(r.size.sanctioned_load_kw ? [["Your sanctioned load (the maximum allowed)", `${r.size.sanctioned_load_kw} kW`]] : []),
      ...(r.size.roof_limit_kw ? [["Your roof fits up to", `${r.size.roof_limit_kw} kW`]] : []),
      [`Rounded down to a standard size (${r.size.step_kw} kW steps)`, `${r.system_kw} kW`],
      ["Panels", `${r.size.panels} × ${r.size.panel_watt} W`],
      ["Roof space needed (about 100 sq ft per kW)", `${n(r.size.roof_sqft)} sq ft`],
    ],

    billTitle: "Your electricity bill",
    billValue: (r) => `${inr(r.bill_now.payable)} → ${inr(r.bill_with_solar.payable)}`,
    billSub: "average month: now → with solar",
    billWhy: (r) => {
      const limit = r.free_units_limit;
      if (r.bill_now.payable < 1)
        return `Your bill is already ₹0${limit ? ` because you use less than Delhi's free ${limit} units` : ""}, so solar has nothing left to save.`;
      if (limit && r.zero_bill_months === 12)
        return `Solar covers ${r.coverage_pct}% of your use. The ${n(r.grid_units_month)} units a month you still take from the grid fall under Delhi's free ${limit} units, so your bill becomes ₹0 every month.`;
      if (limit && r.zero_bill_months > 0)
        return `In ${r.zero_bill_months} of 12 months your grid use falls under Delhi's free ${limit} units, so the bill is ₹0 in those months. In winter, when there is less sun, you pay for the extra units.`;
      return `You only pay for the ${n(r.grid_units_month)} units a month that solar doesn't cover, at the cheaper lower slabs.`;
    },
    billRows: (r) => {
      const a = r.bill_now, b = r.bill_with_solar;
      return [
        ["", "Now", "With solar"],
        ["Units from the grid", n(a.units), n(b.units)],
        ["Energy charge (slab rates)", inr(a.energy), inr(b.energy)],
        ["Fixed charge (by sanctioned load)", inr(a.fixed), inr(b.fixed)],
        ["Power purchase cost (PPAC)", inr(a.ppac), inr(b.ppac)],
        ["Surcharges and electricity tax", inr(a.surcharges_and_tax), inr(b.surcharges_and_tax)],
        ["State government subsidy", a.state_subsidy ? `−${inr(a.state_subsidy)}` : "—", b.state_subsidy ? `−${inr(b.state_subsidy)}` : "—"],
        ["You pay", inr(a.payable), inr(b.payable)],
      ];
    },
    monthsTitle: "Month by month",
    monthsNote: (r) => `Bars show your use each month: the orange part comes from your roof, the blue part from the grid. Winter has less sun.${r.free_units_limit ? ` The dashed line is Delhi's free ${r.free_units_limit} units: while the blue part stays below it, the bill is ₹0.` : ""}`,
    freeLine: (limit) => `free ${limit} units`,
    units: "units", billCol: "Bill with solar", useCol: "Use", monthCol: "Month",

    costTitle: "What you pay",
    costValue: (r) => inr(r.net_cost),
    costSub: "after the government subsidy",
    costWhy: (r) => r.subsidy_detail?.eligible
      ? `A ${r.system_kw} kW system costs about ${inr(r.cost_low)}–${inr(r.cost_high)}. The PM Surya Ghar subsidy of ${inr(r.central_subsidy)} is paid into your bank account after installation.`
      : `A ${r.system_kw} kW system costs about ${inr(r.cost_low)}–${inr(r.cost_high)}. PM Surya Ghar subsidy is only for home (domestic) connections.`,
    costRows: (r) => {
      const d = r.subsidy_detail || {};
      return [
        ["Market price (DCR panels, GST included)", `${inr(r.cost_low)} – ${inr(r.cost_high)}`],
        ["We use the middle of the range", inr(r.cost_mid)],
        ...(d.eligible ? [[`Subsidy: first ${d.first_kw} kW × ${inr(d.first_rate)}`, `−${inr(d.first_kw * d.first_rate)}`]] : []),
        ...(d.eligible && d.third_kw > 0 ? [[`Subsidy: next ${d.third_kw} kW × ${inr(d.third_rate)}`, `−${inr(d.third_kw * d.third_rate)}`]] : []),
        ...(d.eligible ? [["(Subsidy maximum)", inr(d.cap)]] : []),
        ...(r.state_incentive ? [["State incentive", `−${inr(r.state_incentive)}`]] : []),
        ["You pay", inr(r.net_cost)],
      ];
    },

    savingTitle: "What you save",
    savingValue: (r) => `${inr(r.monthly_saving)}/month`,
    savingSub: (r) => `${inr(r.monthly_saving * 12)} in the first year`,

    paybackTitle: "When it pays for itself",
    paybackValue: (r) => (r.payback_years ? `${r.payback_years} years` : "Not within 25 years"),
    paybackSub: (r) => `${lakh(r.lifetime_savings)} better off after ${r.assumptions.lifetime_years} years`,
    paybackWhy: (r) => `You start ${inr(r.net_cost)} down. Each year's savings bring the line up; where it crosses zero, solar has paid for itself. After that, every rupee saved is yours.`,
    paybackRows: (r) => [
      [`Total saved on bills over ${r.assumptions.lifetime_years} years`, lakh(r.lifetime.total_saved)],
      ["What you paid", `−${inr(r.net_cost)}`],
      [`Maintenance (${inr(r.lifetime.maintenance_year)}/year)`, `−${inr(r.lifetime.maintenance_year * r.assumptions.lifetime_years)}`],
      [`One inverter replacement (year ${r.assumptions.inverter_year})`, `−${inr(r.lifetime.inverter_cost)}`],
      ["You end up better off by", lakh(r.lifetime_savings)],
    ],
    yearAxis: "years", breakEven: "pays back", cumulative: "Money position", yearCol: "Year",

    loanTitle: "If you take a loan",
    loanValue: (r) => `EMI ${inr(r.loan.emi)}/month`,
    loanSub: (r) => r.loan.net_monthly >= 0 ? `${inr(r.loan.net_monthly)}/month ahead from the first month` : `${inr(-r.loan.net_monthly)}/month more than you save, until the loan ends`,
    loanWhy: (r) => `PM Surya Ghar offers collateral-free bank loans at about ${r.loan.rate_pct}%. Borrowing ${inr(r.loan.amount)} for ${r.loan.years} years costs ${inr(r.loan.emi)} a month${r.loan.net_monthly >= 0 ? `, less than the ${inr(r.monthly_saving)} you save, so solar pays its own EMI` : ""}. Check the current rate with your bank.`,
    emi: "Loan EMI", save: "Bill saving",

    co2Title: "Cleaner air",
    co2Value: (r) => `${r.co2_tonnes_year} tonnes CO₂/year`,
    co2Sub: (r) => `about ${n(r.co2_tonnes_lifetime)} tonnes over ${r.assumptions.lifetime_years} years`,
    co2Why: (r) => `Most of India's grid power comes from coal. Each unit your roof makes avoids about ${r.assumptions.emission_kg_per_unit} kg of CO₂.`,

    assumptionsTitle: "Assumptions we made",
    assumptions: (r) => [
      `Sunlight: long-term average for your location from NASA (${r.ghi} kWh/m²/day over the year).`,
      `Panels deliver ${Math.round(r.assumptions.performance_ratio * 100)}% of their rating after heat, dust and wiring losses, and lose ${r.assumptions.degradation_pct}% a year as they age.`,
      `Your use is the same every month (the average of your bills).`,
      `Electricity prices rise ${r.assumptions.tariff_growth_pct}% a year.`,
      `Maintenance ${inr(r.assumptions.maintenance_per_kw)} per kW a year; one inverter replacement in year ${r.assumptions.inverter_year}.`,
      `Extra units sent to the grid in sunny months earn nothing here, so real savings may be a little higher.`,
      `Prices and subsidies change. Check them against real quotes and pmsuryaghar.gov.in.`,
    ],
    tapForDetails: "How we worked this out",
    seeTable: "See as a table",
  },

  hi: {
    coverageTitle: "आपकी बिजली का कितना हिस्सा सोलर बनाएगा",
    coverage: (r) => `सोलर आपकी ${r.coverage_pct}% खपत पूरी करेगा। हर महीने आपकी ${n(r.monthly_units)} यूनिट में से लगभग ${n(r.solar_units_month)} यूनिट छत से आएँगी; लगभग ${n(r.grid_units_month)} यूनिट अब भी ग्रिड से लेनी होंगी।`,
    solar: "छत से", grid: "ग्रिड से",

    sizeTitle: "सुझाया गया सिस्टम",
    sizeValue: (r) => `${r.system_kw} kW`,
    sizeSub: (r) => `${r.size.panels} पैनल · लगभग ${n(r.size.roof_sqft)} वर्ग फ़ुट छाया-रहित छत`,
    sizeWhy: (r) => `आपकी लगभग ${r.size.coverage_target_pct}% खपत पूरी करने के लिए, ${LIMIT.hi[r.size.limited_by]} की सीमा में।`,
    sizeRows: (r) => [
      ["आपकी औसत खपत", `${n(r.monthly_units)} यूनिट/महीना`],
      ["यहाँ 1 kW पैनल कितनी बिजली बनाते हैं", `${n(r.size.yield_per_kw_year)} यूनिट/साल (${n(r.size.yield_per_kw_year / 12)}/महीना)`],
      [`${r.size.coverage_target_pct}% खपत के लिए ज़रूरी साइज़`, `${r.size.needed_kw} kW`],
      ...(r.size.sanctioned_load_kw ? [["आपका स्वीकृत लोड (अधिकतम सीमा)", `${r.size.sanctioned_load_kw} kW`]] : []),
      ...(r.size.roof_limit_kw ? [["आपकी छत पर अधिकतम", `${r.size.roof_limit_kw} kW`]] : []),
      [`मानक साइज़ में नीचे की ओर (${r.size.step_kw} kW के क़दम)`, `${r.system_kw} kW`],
      ["पैनल", `${r.size.panels} × ${r.size.panel_watt} W`],
      ["ज़रूरी छत (लगभग 100 वर्ग फ़ुट प्रति kW)", `${n(r.size.roof_sqft)} वर्ग फ़ुट`],
    ],

    billTitle: "आपका बिजली बिल",
    billValue: (r) => `${inr(r.bill_now.payable)} → ${inr(r.bill_with_solar.payable)}`,
    billSub: "औसत महीना: अभी → सोलर के बाद",
    billWhy: (r) => {
      const limit = r.free_units_limit;
      if (r.bill_now.payable < 1)
        return `आपका बिल पहले से ₹0 है${limit ? ` क्योंकि आप दिल्ली की ${limit} मुफ़्त यूनिट से कम इस्तेमाल करते हैं` : ""}, इसलिए सोलर से बचाने को कुछ नहीं बचता।`;
      if (limit && r.zero_bill_months === 12)
        return `सोलर आपकी ${r.coverage_pct}% खपत पूरी करेगा। बाक़ी ${n(r.grid_units_month)} यूनिट जो आप ग्रिड से लेंगे, वे दिल्ली की ${limit} मुफ़्त यूनिट के अंदर आती हैं, इसलिए हर महीने बिल ₹0 होगा।`;
      if (limit && r.zero_bill_months > 0)
        return `12 में से ${r.zero_bill_months} महीनों में ग्रिड की खपत दिल्ली की ${limit} मुफ़्त यूनिट के अंदर रहेगी, इसलिए उन महीनों में बिल ₹0 होगा। सर्दियों में धूप कम होने से अतिरिक्त यूनिट का बिल आएगा।`;
      return `आप केवल उन ${n(r.grid_units_month)} यूनिट का भुगतान करेंगे जो सोलर पूरी नहीं करता, वह भी सस्ते निचले स्लैब पर।`;
    },
    billRows: (r) => {
      const a = r.bill_now, b = r.bill_with_solar;
      return [
        ["", "अभी", "सोलर के बाद"],
        ["ग्रिड से यूनिट", n(a.units), n(b.units)],
        ["ऊर्जा शुल्क (स्लैब दरें)", inr(a.energy), inr(b.energy)],
        ["फ़िक्स्ड चार्ज (स्वीकृत लोड पर)", inr(a.fixed), inr(b.fixed)],
        ["बिजली ख़रीद लागत (PPAC)", inr(a.ppac), inr(b.ppac)],
        ["सरचार्ज और बिजली कर", inr(a.surcharges_and_tax), inr(b.surcharges_and_tax)],
        ["राज्य सरकार की सब्सिडी", a.state_subsidy ? `−${inr(a.state_subsidy)}` : "—", b.state_subsidy ? `−${inr(b.state_subsidy)}` : "—"],
        ["आप भुगतान करेंगे", inr(a.payable), inr(b.payable)],
      ];
    },
    monthsTitle: "महीने-दर-महीने",
    monthsNote: (r) => `बार हर महीने की खपत दिखाते हैं: नारंगी हिस्सा छत से, नीला हिस्सा ग्रिड से। सर्दियों में धूप कम होती है।${r.free_units_limit ? ` डैश वाली रेखा दिल्ली की ${r.free_units_limit} मुफ़्त यूनिट है: जब तक नीला हिस्सा इसके नीचे है, बिल ₹0 है।` : ""}`,
    freeLine: (limit) => `${limit} मुफ़्त यूनिट`,
    units: "यूनिट", billCol: "सोलर के बाद बिल", useCol: "खपत", monthCol: "महीना",

    costTitle: "आपका ख़र्च",
    costValue: (r) => inr(r.net_cost),
    costSub: "सरकारी सब्सिडी के बाद",
    costWhy: (r) => r.subsidy_detail?.eligible
      ? `${r.system_kw} kW सिस्टम की क़ीमत लगभग ${inr(r.cost_low)}–${inr(r.cost_high)} है। PM सूर्य घर सब्सिडी ${inr(r.central_subsidy)} इंस्टॉलेशन के बाद आपके बैंक खाते में आती है।`
      : `${r.system_kw} kW सिस्टम की क़ीमत लगभग ${inr(r.cost_low)}–${inr(r.cost_high)} है। PM सूर्य घर सब्सिडी केवल घरेलू कनेक्शन के लिए है।`,
    costRows: (r) => {
      const d = r.subsidy_detail || {};
      return [
        ["बाज़ार क़ीमत (DCR पैनल, GST सहित)", `${inr(r.cost_low)} – ${inr(r.cost_high)}`],
        ["हम बीच की क़ीमत लेते हैं", inr(r.cost_mid)],
        ...(d.eligible ? [[`सब्सिडी: पहले ${d.first_kw} kW × ${inr(d.first_rate)}`, `−${inr(d.first_kw * d.first_rate)}`]] : []),
        ...(d.eligible && d.third_kw > 0 ? [[`सब्सिडी: अगले ${d.third_kw} kW × ${inr(d.third_rate)}`, `−${inr(d.third_kw * d.third_rate)}`]] : []),
        ...(d.eligible ? [["(अधिकतम सब्सिडी)", inr(d.cap)]] : []),
        ...(r.state_incentive ? [["राज्य प्रोत्साहन", `−${inr(r.state_incentive)}`]] : []),
        ["आपका ख़र्च", inr(r.net_cost)],
      ];
    },

    savingTitle: "आपकी बचत",
    savingValue: (r) => `${inr(r.monthly_saving)}/महीना`,
    savingSub: (r) => `पहले साल में ${inr(r.monthly_saving * 12)}`,

    paybackTitle: "लागत कब वसूल होगी",
    paybackValue: (r) => (r.payback_years ? `${r.payback_years} साल` : "25 साल में नहीं"),
    paybackSub: (r) => `${r.assumptions.lifetime_years} साल में कुल फ़ायदा ${lakhHi(r.lifetime_savings)}`,
    paybackWhy: (r) => `शुरुआत में आप ${inr(r.net_cost)} ख़र्च करते हैं। हर साल की बचत रेखा को ऊपर ले जाती है; जहाँ यह शून्य पार करती है, वहाँ लागत वसूल। उसके बाद हर बचत आपकी है।`,
    paybackRows: (r) => [
      [`${r.assumptions.lifetime_years} साल में बिल पर कुल बचत`, lakhHi(r.lifetime.total_saved)],
      ["आपका ख़र्च", `−${inr(r.net_cost)}`],
      [`मेंटेनेंस (${inr(r.lifetime.maintenance_year)}/साल)`, `−${inr(r.lifetime.maintenance_year * r.assumptions.lifetime_years)}`],
      [`एक बार इन्वर्टर बदलना (साल ${r.assumptions.inverter_year})`, `−${inr(r.lifetime.inverter_cost)}`],
      ["कुल फ़ायदा", lakhHi(r.lifetime_savings)],
    ],
    yearAxis: "साल", breakEven: "लागत वसूल", cumulative: "कुल स्थिति", yearCol: "साल",

    loanTitle: "अगर आप लोन लें",
    loanValue: (r) => `EMI ${inr(r.loan.emi)}/महीना`,
    loanSub: (r) => r.loan.net_monthly >= 0 ? `पहले महीने से ${inr(r.loan.net_monthly)}/महीना फ़ायदा` : `लोन ख़त्म होने तक बचत से ${inr(-r.loan.net_monthly)}/महीना ज़्यादा`,
    loanWhy: (r) => `PM सूर्य घर के तहत बैंक लगभग ${r.loan.rate_pct}% पर बिना गारंटी लोन देते हैं। ${inr(r.loan.amount)} का ${r.loan.years} साल का लोन ${inr(r.loan.emi)} महीना${r.loan.net_monthly >= 0 ? `, जो आपकी ${inr(r.monthly_saving)} की बचत से कम है, यानी सोलर अपनी EMI ख़ुद भरता है` : ""}। मौजूदा दर बैंक से पूछें।`,
    emi: "लोन EMI", save: "बिल में बचत",

    co2Title: "साफ़ हवा",
    co2Value: (r) => `${r.co2_tonnes_year} टन CO₂/साल`,
    co2Sub: (r) => `${r.assumptions.lifetime_years} साल में लगभग ${n(r.co2_tonnes_lifetime)} टन`,
    co2Why: (r) => `भारत की ज़्यादातर बिजली कोयले से बनती है। आपकी छत की हर यूनिट लगभग ${r.assumptions.emission_kg_per_unit} किलो CO₂ बचाती है।`,

    assumptionsTitle: "हमने क्या मान लिया",
    assumptions: (r) => [
      `धूप: NASA के अनुसार आपकी जगह का लंबे समय का औसत (साल भर में ${r.ghi} kWh/m²/दिन)।`,
      `गर्मी, धूल और तारों के नुक़सान के बाद पैनल अपनी क्षमता का ${Math.round(r.assumptions.performance_ratio * 100)}% देते हैं, और हर साल ${r.assumptions.degradation_pct}% कम होते हैं।`,
      `आपकी खपत हर महीने एक जैसी (आपके बिलों का औसत)।`,
      `बिजली की दरें हर साल ${r.assumptions.tariff_growth_pct}% बढ़ती हैं।`,
      `मेंटेनेंस ${inr(r.assumptions.maintenance_per_kw)} प्रति kW प्रति साल; साल ${r.assumptions.inverter_year} में एक बार इन्वर्टर बदलना।`,
      `धूप वाले महीनों में ग्रिड को भेजी अतिरिक्त बिजली का यहाँ कोई पैसा नहीं जोड़ा गया, इसलिए असली बचत थोड़ी ज़्यादा हो सकती है।`,
      `क़ीमतें और सब्सिडी बदलती रहती हैं। असली कोटेशन और pmsuryaghar.gov.in से मिलान करें।`,
    ],
    tapForDetails: "हमने यह कैसे निकाला",
    seeTable: "तालिका में देखें",
  },
};

export const ex = (lang, key, r) => {
  const v = EXPLAIN[lang]?.[key] ?? EXPLAIN.en[key];
  return typeof v === "function" ? v(r) : v;
};
