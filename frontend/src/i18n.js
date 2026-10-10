const inr = (n) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

const STRINGS = {
  en: {
    tagline: "Is rooftop solar worth it for you? Two photos, one honest answer.",
    checkBill: "Check my electricity bill",
    checkQuote: "I have a vendor quote",
    snapBill: "Photo of your electricity bill",
    snapBillTip: "Keep the units, the dates and the consumption history table in view. A PDF from your discom's app also works.",
    snapQuote: "Photo of the vendor's quote",
    snapQuoteTip: "Include the price, panel brand, inverter and warranty sections.",
    choosePhoto: "Take photo / choose file",
    reading: "Reading your document… this takes 10–40 seconds",
    uploading: "Uploading…",
    confirmTitle: "Check what we read",
    confirmTip: "Fix anything that's wrong. Your answer is only as good as these numbers.",
    checkUnits: "The photo was hard to read. Please check the units against your bill.",
    checkHistory: "Some past months looked wrong and were left out. Add them if you can see them on your bill.",
    discom: "Electricity company",
    category: "Connection type",
    domestic: "Domestic (home)",
    non_domestic: "Non-domestic (shop/office)",
    other: "Other",
    load: "Sanctioned load (kW)",
    days: "Days in this bill",
    units: "Units in this bill",
    history: "Past units (comma separated)",
    next: "Next",
    back: "Back",
    whereTitle: "Where is the house, and how much roof?",
    useLocation: "Use my location",
    orCity: "or pick your city",
    located: "Location set",
    roof: "Shadow-free roof space",
    roof_small: "Small (under 15 m²)",
    roof_medium: "Medium (15–30 m²)",
    roof_large: "Large (over 30 m²)",
    roof_unknown: "Not sure",
    calculate: "Show my answer",
    youPay: "You pay (after subsidy)",
    saving: "Saving per month",
    payback: "Pays back in",
    years: "years",
    co2: "CO₂ avoided per year",
    tonnes: "tonnes",
    size: "Recommended size",
    billNow: "Your bill now",
    billSolar: "Bill with solar",
    listen: "Listen",
    share: "Share",
    showWorking: "Show my working",
    nextSteps: "What happens next",
    checkAQuote: "Check a vendor quote",
    startOver: "Start over",
    copy: "Copy questions",
    copied: "Copied",
    askVendor: "Questions to ask your vendor",
    quoteResult: "Quote check",
    privacy: "Bill photos are deleted within 24 hours. We never store your name, address or account number.",
    notConfigured: "API not configured: set VITE_API_URL in frontend/.env.local",
    roughUnits: "units/month",
    verdict_yes: "Yes, solar suits you",
    verdict_maybe: "Worth it only if you'll stay 10+ years",
    verdict_not_worth: "Solar won't pay off for you",
    verdict_unsupported_discom: "We don't support this electricity company yet",
    reason_good_payback: "Your savings repay the cost quickly.",
    reason_medium_payback: "It pays back, but slowly.",
    reason_long_payback: "The savings are too small to repay the cost in a reasonable time.",
    reason_low_usage: "You use very little electricity, so there is little to save.",
    reason_already_low_bill: "Your bill is already close to zero because of the state's free-electricity scheme.",
    reason_load_limit: "Your sanctioned load is too small for a useful system. Ask your discom for a load increase first.",
    reason_too_small: "Your use is too low for even a 1 kW system.",
    flag_single_month: "Based on one bill only. Summer and winter use can differ a lot.",
    flag_load_increase: "Your sanctioned load limits the size. A load increase would allow a bigger system.",
    flag_not_eligible_central_subsidy: "This is a non-domestic connection: the PM Surya Ghar subsidy is for homes only.",
    flag_state_subsidy_now: "You already get the state's electricity subsidy, which reduces what solar can save.",
    overall_green: "This quote looks fair",
    overall_amber: "Some things need checking",
    overall_red: "Be careful with this quote",
    steps: [
      "Register on the PM Surya Ghar national portal (pmsuryaghar.gov.in) with your electricity account number.",
      "Apply for rooftop solar on the portal and wait for your discom's feasibility approval.",
      "Pick a vendor registered on the portal. Get it in writing that panels are DCR.",
      "The vendor installs the system.",
      "Submit installation details; the discom installs and inspects the net meter.",
      "Submit your bank details on the portal. The subsidy is paid into your account.",
    ],
    speech: (r) =>
      r.verdict === "not_worth" || !r.system_kw
        ? `Solar won't pay off for you. ${STRINGS.en["reason_" + r.reason] || ""}`
        : `A ${r.system_kw} kilowatt system suits you. You pay about ${inr(r.net_cost)} after subsidy, save about ${inr(r.monthly_saving)} a month, and it pays back in about ${r.payback_years} years.`,
  },
  hi: {
    tagline: "क्या रूफ़टॉप सोलर आपके लिए फ़ायदेमंद है? दो फ़ोटो, एक सच्चा जवाब।",
    checkBill: "मेरा बिजली बिल जाँचें",
    checkQuote: "मेरे पास वेंडर का कोटेशन है",
    snapBill: "अपने बिजली बिल की फ़ोटो",
    snapBillTip: "यूनिट, तारीख़ें और खपत इतिहास वाली तालिका साफ़ दिखनी चाहिए। डिस्कॉम ऐप का PDF भी चलेगा।",
    snapQuote: "वेंडर के कोटेशन की फ़ोटो",
    snapQuoteTip: "क़ीमत, पैनल ब्रांड, इन्वर्टर और वारंटी वाला हिस्सा शामिल करें।",
    choosePhoto: "फ़ोटो लें / फ़ाइल चुनें",
    reading: "आपका दस्तावेज़ पढ़ा जा रहा है… 10–40 सेकंड लगेंगे",
    uploading: "अपलोड हो रहा है…",
    confirmTitle: "जो हमने पढ़ा, उसे जाँचें",
    confirmTip: "कुछ ग़लत हो तो ठीक करें। जवाब इन्हीं आँकड़ों पर निर्भर है।",
    checkUnits: "फ़ोटो साफ़ नहीं पढ़ी गई। कृपया यूनिट अपने बिल से मिलाकर देखें।",
    checkHistory: "पिछले कुछ महीनों के आँकड़े ग़लत लगे, इसलिए हटा दिए। बिल पर दिखें तो जोड़ दें।",
    discom: "बिजली कंपनी",
    category: "कनेक्शन का प्रकार",
    domestic: "घरेलू",
    non_domestic: "ग़ैर-घरेलू (दुकान/दफ़्तर)",
    other: "अन्य",
    load: "स्वीकृत लोड (kW)",
    days: "इस बिल के दिन",
    units: "इस बिल की यूनिट",
    history: "पिछली यूनिट (कॉमा से अलग)",
    next: "आगे",
    back: "पीछे",
    whereTitle: "घर कहाँ है, और छत कितनी बड़ी है?",
    useLocation: "मेरी लोकेशन लें",
    orCity: "या अपना शहर चुनें",
    located: "लोकेशन मिल गई",
    roof: "छाया-रहित छत",
    roof_small: "छोटी (15 m² से कम)",
    roof_medium: "मध्यम (15–30 m²)",
    roof_large: "बड़ी (30 m² से ज़्यादा)",
    roof_unknown: "पता नहीं",
    calculate: "मेरा जवाब दिखाएँ",
    youPay: "आपका ख़र्च (सब्सिडी के बाद)",
    saving: "हर महीने बचत",
    payback: "लागत वसूली",
    years: "साल",
    co2: "हर साल CO₂ की बचत",
    tonnes: "टन",
    size: "सुझाया गया साइज़",
    billNow: "अभी का बिल",
    billSolar: "सोलर के बाद बिल",
    listen: "सुनें",
    share: "शेयर करें",
    showWorking: "हिसाब देखें",
    nextSteps: "आगे क्या होगा",
    checkAQuote: "वेंडर का कोटेशन जाँचें",
    startOver: "फिर से शुरू करें",
    copy: "सवाल कॉपी करें",
    copied: "कॉपी हो गया",
    askVendor: "वेंडर से पूछें",
    quoteResult: "कोटेशन जाँच",
    privacy: "बिल की फ़ोटो 24 घंटे में मिटा दी जाती है। हम आपका नाम, पता या खाता संख्या नहीं रखते।",
    notConfigured: "API सेट नहीं है: frontend/.env.local में VITE_API_URL डालें",
    roughUnits: "यूनिट/महीना",
    verdict_yes: "हाँ, सोलर आपके लिए सही है",
    verdict_maybe: "फ़ायदा तभी, जब आप 10+ साल यहीं रहें",
    verdict_not_worth: "सोलर से आपको ख़ास फ़ायदा नहीं होगा",
    verdict_unsupported_discom: "यह बिजली कंपनी अभी उपलब्ध नहीं है",
    reason_good_payback: "बचत से लागत जल्दी वसूल हो जाएगी।",
    reason_medium_payback: "लागत वसूल होगी, पर धीरे-धीरे।",
    reason_long_payback: "बचत इतनी कम है कि लागत वसूलने में बहुत समय लगेगा।",
    reason_low_usage: "आपकी बिजली खपत बहुत कम है, इसलिए बचत भी कम होगी।",
    reason_already_low_bill: "राज्य की मुफ़्त बिजली योजना से आपका बिल पहले ही लगभग शून्य है।",
    reason_load_limit: "आपका स्वीकृत लोड बहुत कम है। पहले डिस्कॉम से लोड बढ़वाएँ।",
    reason_too_small: "आपकी खपत 1 kW सिस्टम के लिए भी कम है।",
    flag_single_month: "सिर्फ़ एक बिल पर आधारित। गर्मी और सर्दी की खपत में बड़ा अंतर हो सकता है।",
    flag_load_increase: "स्वीकृत लोड की वजह से साइज़ सीमित है। लोड बढ़ाने पर बड़ा सिस्टम लग सकता है।",
    flag_not_eligible_central_subsidy: "यह ग़ैर-घरेलू कनेक्शन है: PM सूर्य घर सब्सिडी सिर्फ़ घरों के लिए है।",
    flag_state_subsidy_now: "आपको पहले से राज्य की बिजली सब्सिडी मिलती है, इसलिए सोलर से बचत कम होगी।",
    overall_green: "यह कोटेशन ठीक लगता है",
    overall_amber: "कुछ बातें जाँचनी होंगी",
    overall_red: "इस कोटेशन से सावधान रहें",
    steps: [
      "PM सूर्य घर पोर्टल (pmsuryaghar.gov.in) पर अपने बिजली खाता नंबर से रजिस्टर करें।",
      "पोर्टल पर रूफ़टॉप सोलर के लिए आवेदन करें और डिस्कॉम की मंज़ूरी का इंतज़ार करें।",
      "पोर्टल पर रजिस्टर्ड वेंडर चुनें। पैनल DCR हैं, यह लिखित में लें।",
      "वेंडर सिस्टम लगाता है।",
      "इंस्टॉलेशन की जानकारी जमा करें; डिस्कॉम नेट मीटर लगाकर जाँच करता है।",
      "पोर्टल पर बैंक विवरण दें। सब्सिडी आपके खाते में आ जाएगी।",
    ],
    speech: (r) =>
      r.verdict === "not_worth" || !r.system_kw
        ? `सोलर से आपको ख़ास फ़ायदा नहीं होगा। ${STRINGS.hi["reason_" + r.reason] || ""}`
        : `आपके लिए ${r.system_kw} किलोवाट का सिस्टम सही है। सब्सिडी के बाद लगभग ${inr(r.net_cost)} लगेंगे, हर महीने लगभग ${inr(r.monthly_saving)} की बचत होगी, और लगभग ${r.payback_years} साल में लागत वसूल हो जाएगी।`,
  },
};

// One sentence per quote check, from its id + status + params (computed by the backend rules).
const CHECKS = {
  en: {
    price: (s, p) =>
      p.missing ? "Price or system size not found on the quote."
        : p.too_low ? `₹${p.price_per_kw?.toLocaleString("en-IN")}/kW is suspiciously cheap. Check panel quality and what's left out.`
        : s === "green" ? `₹${p.price_per_kw?.toLocaleString("en-IN")}/kW is within the normal range (₹${p.low_per_kw?.toLocaleString("en-IN")}–${p.high_per_kw?.toLocaleString("en-IN")}).`
        : `₹${p.price_per_kw?.toLocaleString("en-IN")}/kW is ${p.pct_over}% above the normal range (up to ₹${p.high_per_kw?.toLocaleString("en-IN")}).`,
    dcr: (s, p) =>
      s === "green" ? `DCR panels stated (model ${p.model}).`
        : s === "amber" ? "DCR claimed, but the panel model isn't named."
        : "No mention of DCR panels. Without them the subsidy can be rejected.",
    almm: (s, p) =>
      !p.maker ? "Panel brand not named."
        : s === "green" ? `${p.maker} is an approved (ALMM) manufacturer.`
        : `${p.maker} isn't in our approved-maker list. Check the official ALMM list.`,
    size: (s, p) =>
      p.missing ? "System size not found."
        : p.above_load ? `${p.quoted} kW is above your sanctioned load of ${p.load} kW.`
        : s === "info" ? `Quote is for ${p.quoted} kW. Check your bill to see what size you need.`
        : s === "green" ? `${p.quoted} kW matches what you need (${p.recommended} kW).`
        : `${p.quoted} kW, but your bill suggests ${p.recommended} kW.`,
    inverter: (s, p) =>
      p.missing ? "No inverter details."
        : p.type === "off_grid" ? "Off-grid inverter: net metering and the subsidy need an on-grid system."
        : p.type === "hybrid" ? "Hybrid inverter (costs more). Make sure you need batteries."
        : s === "green" ? "On-grid inverter, capacity matches the panels."
        : `Inverter capacity (${p.capacity} kW) doesn't match the panels (${p.system_kw} kW).`,
    warranties: (s, p) =>
      s === "green" ? "Panel, inverter and maintenance warranties are all stated."
        : `Missing or short: ${p.missing.map((m) => ({ panel_performance_years: "25-year panel performance", inverter_years: "5-year inverter", maintenance_years: "5-year maintenance" })[m]).join(", ")}.`,
    items: (s, p) =>
      s === "red" ? `Charged extra: ${p.extras.join(", ")}. These are normally included.`
        : s === "green" ? "All standard items are included."
        : `Not clearly included: ${p.unclear.map((i) => i.replaceAll("_", " ")).join(", ")}.`,
    payment: (s, p) =>
      p.missing ? "Payment terms not stated."
        : s === "green" ? `${p.advance_pct}% advance is reasonable.`
        : `${p.advance_pct}% advance is high. Pay most of it after installation.`,
    subsidy: (s) =>
      s === "green" ? "Vendor will apply for your subsidy on the portal."
        : s === "red" ? "Vendor asks for the subsidy amount or promises cash back. This is a warning sign."
        : "Quote doesn't say who files the subsidy application.",
  },
  hi: {
    price: (s, p) =>
      p.missing ? "कोटेशन में क़ीमत या साइज़ नहीं मिला।"
        : p.too_low ? `₹${p.price_per_kw?.toLocaleString("en-IN")}/kW संदिग्ध रूप से सस्ता है। पैनल की गुणवत्ता जाँचें।`
        : s === "green" ? `₹${p.price_per_kw?.toLocaleString("en-IN")}/kW सामान्य दायरे में है (₹${p.low_per_kw?.toLocaleString("en-IN")}–${p.high_per_kw?.toLocaleString("en-IN")})।`
        : `₹${p.price_per_kw?.toLocaleString("en-IN")}/kW सामान्य से ${p.pct_over}% ज़्यादा है।`,
    dcr: (s, p) =>
      s === "green" ? `DCR पैनल लिखे हैं (मॉडल ${p.model})।`
        : s === "amber" ? "DCR लिखा है, पर पैनल मॉडल नहीं लिखा।"
        : "DCR पैनल का ज़िक्र नहीं। इनके बिना सब्सिडी रुक सकती है।",
    almm: (s, p) =>
      !p.maker ? "पैनल ब्रांड नहीं लिखा।"
        : s === "green" ? `${p.maker} स्वीकृत (ALMM) निर्माता है।`
        : `${p.maker} हमारी स्वीकृत सूची में नहीं है। आधिकारिक ALMM सूची जाँचें।`,
    size: (s, p) =>
      p.missing ? "सिस्टम साइज़ नहीं मिला।"
        : p.above_load ? `${p.quoted} kW आपके स्वीकृत लोड ${p.load} kW से ज़्यादा है।`
        : s === "info" ? `कोटेशन ${p.quoted} kW का है। ज़रूरी साइज़ जानने के लिए बिल जाँचें।`
        : s === "green" ? `${p.quoted} kW आपकी ज़रूरत (${p.recommended} kW) के बराबर है।`
        : `${p.quoted} kW, पर आपके बिल के हिसाब से ${p.recommended} kW चाहिए।`,
    inverter: (s, p) =>
      p.missing ? "इन्वर्टर की जानकारी नहीं।"
        : p.type === "off_grid" ? "ऑफ़-ग्रिड इन्वर्टर: नेट मीटरिंग और सब्सिडी के लिए ऑन-ग्रिड चाहिए।"
        : p.type === "hybrid" ? "हाइब्रिड इन्वर्टर (महँगा)। क्या आपको बैटरी चाहिए?"
        : s === "green" ? "ऑन-ग्रिड इन्वर्टर, क्षमता पैनल के बराबर।"
        : `इन्वर्टर क्षमता (${p.capacity} kW) पैनल (${p.system_kw} kW) से मेल नहीं खाती।`,
    warranties: (s, p) =>
      s === "green" ? "पैनल, इन्वर्टर और मेंटेनेंस वारंटी सब लिखी हैं।"
        : `कम या नहीं लिखी: ${p.missing.map((m) => ({ panel_performance_years: "25 साल पैनल परफ़ॉर्मेंस", inverter_years: "5 साल इन्वर्टर", maintenance_years: "5 साल मेंटेनेंस" })[m]).join(", ")}।`,
    items: (s, p) =>
      s === "red" ? `अलग से चार्ज: ${p.extras.join(", ")}। ये आमतौर पर शामिल होते हैं।`
        : s === "green" ? "सभी ज़रूरी चीज़ें शामिल हैं।"
        : `साफ़ नहीं कि शामिल हैं: ${p.unclear.map((i) => i.replaceAll("_", " ")).join(", ")}।`,
    payment: (s, p) =>
      p.missing ? "भुगतान की शर्तें नहीं लिखीं।"
        : s === "green" ? `${p.advance_pct}% एडवांस ठीक है।`
        : `${p.advance_pct}% एडवांस ज़्यादा है। ज़्यादातर भुगतान इंस्टॉलेशन के बाद करें।`,
    subsidy: (s) =>
      s === "green" ? "वेंडर पोर्टल पर आपकी सब्सिडी का आवेदन करेगा।"
        : s === "red" ? "वेंडर सब्सिडी की रक़म माँग रहा है या कैशबैक का वादा कर रहा है। यह ख़तरे का संकेत है।"
        : "कोटेशन में नहीं लिखा कि सब्सिडी का आवेदन कौन करेगा।",
  },
};

const QUESTIONS = {
  en: {
    price: "Can you explain why your price per kW is higher than the usual range?",
    dcr: "Can you confirm in writing that the panels are DCR, with the model number?",
    almm: "Is the panel manufacturer on the MNRE ALMM list? Please share proof.",
    size: "Why this system size? My bill suggests a different size.",
    inverter: "Which on-grid inverter is included, and what is its capacity?",
    warranties: "Please write the panel, inverter and maintenance warranty periods into the quote.",
    items: "Is everything included: structure, cabling, earthing, lightning arrester, net meter process, installation?",
    payment: "Can I pay most of the amount after installation and net meter approval?",
    subsidy: "Will you file my PM Surya Ghar subsidy application on the national portal?",
  },
  hi: {
    price: "आपकी प्रति kW क़ीमत सामान्य से ज़्यादा क्यों है?",
    dcr: "क्या आप लिखित में दे सकते हैं कि पैनल DCR हैं, मॉडल नंबर के साथ?",
    almm: "क्या पैनल निर्माता MNRE की ALMM सूची में है? सबूत दिखाएँ।",
    size: "यह साइज़ क्यों? मेरे बिल के हिसाब से अलग साइज़ चाहिए।",
    inverter: "कौन-सा ऑन-ग्रिड इन्वर्टर है और उसकी क्षमता कितनी है?",
    warranties: "पैनल, इन्वर्टर और मेंटेनेंस वारंटी कोटेशन में लिखकर दें।",
    items: "क्या सब शामिल है: स्ट्रक्चर, वायरिंग, अर्थिंग, लाइटनिंग अरेस्टर, नेट मीटर, इंस्टॉलेशन?",
    payment: "क्या मैं ज़्यादातर भुगतान इंस्टॉलेशन और नेट मीटर के बाद कर सकता/सकती हूँ?",
    subsidy: "क्या आप नेशनल पोर्टल पर मेरी PM सूर्य घर सब्सिडी का आवेदन करेंगे?",
  },
};

export const t = (lang, key) => STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
export const checkText = (lang, c) => CHECKS[lang][c.id](c.status, c.params || {});
export const fallbackQuestions = (lang, checks) =>
  checks.filter((c) => c.status === "amber" || c.status === "red").map((c) => QUESTIONS[lang][c.id]);
export { inr };
