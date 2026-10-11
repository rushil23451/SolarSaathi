import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { CheckCircle, Info, MagnifyingGlass, MapPin, WarningCircle } from "@phosphor-icons/react";
import { useLang } from "../i18n";
import { lastReport, useFlow } from "../app/flow";
import { analyse } from "../lib/api";
import { CITIES, inIndia } from "../lib/cities";
import type { Roof } from "../types/api";
import { Button, Spinner, Steps, inputClass } from "../ui/controls";
import { useTitle } from "../lib/useTitle";

import { ROOF_SQFT, Roof3D } from "../features/Roof3D";

export function Home() {
  const { t, lang } = useLang();
  const flow = useFlow();
  const navigate = useNavigate();
  const { bill, place, roof } = flow.state;
  const [query, setQuery] = useState(place?.label ?? "");
  const [geo, setGeo] = useState<"idle" | "busy" | "failed" | "outside">("idle");
  const [noRoof, setNoRoof] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  useTitle(t.home.title);
  useEffect(() => setError(null), [place, roof]);

  if (!bill) return <Navigate to="/bill" replace />;

  const cityName = (c: (typeof CITIES)[number]) => (lang === "hi" ? c.hi : c.name);
  const q = query.trim().toLowerCase();
  const matches = q && q !== place?.label.toLowerCase()
    ? CITIES.filter((c) => c.name.toLowerCase().includes(q) || c.hi.includes(query.trim())).slice(0, 6)
    : [];

  function locate() {
    if (!navigator.geolocation) return setGeo("failed");
    setGeo("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        if (!inIndia(lat, lon)) return setGeo("outside");
        setGeo("idle");
        flow.update({ place: { lat, lon, label: t.home.myLocation } });
        setQuery(t.home.myLocation);
      },
      () => setGeo("failed"),
      { timeout: 10000, maximumAge: 600000 },
    );
  }

  async function submit() {
    setSubmitted(true);
    if (!place || !roof || noRoof || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await analyse(bill!, place.lat, place.lon, roof);
      lastReport.set(res.analysisId);
      navigate(`/report/${res.analysisId}`, { viewTransition: true });
    } catch {
      setError(t.home.failed);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1280px] px-8 pb-24 pt-10">
      <Steps steps={t.steps.bill} current={2} label={t.steps.label} />
      <div className="mt-10 max-w-[880px]">
        <h1 tabIndex={-1} className="type-h1 focus:outline-none">{t.home.title}</h1>
        <p className="mt-4 max-w-[60ch] type-prose text-ink-2">{t.home.lead}</p>
      </div>

      <div className="mt-10 grid grid-cols-12 gap-12">
        <section className="col-span-5 flex flex-col gap-4" aria-labelledby="city-label">
          <label id="city-label" htmlFor="city" className="type-h3">{t.home.city}</label>
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={20} aria-hidden="true" />
            <input
              id="city"
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); if (place) flow.update({ place: null }); }}
              placeholder={t.home.cityPlaceholder}
              autoComplete="off"
              spellCheck={false}
              className={`${inputClass} pl-11`}
              aria-describedby="city-status"
            />
          </div>
          {matches.length > 0 && (
            <ul className="overflow-hidden rounded-[var(--radius-input)] border border-line bg-surface shadow-[var(--shadow-panel)]">
              {matches.map((c) => (
                <li key={c.name}>
                  <button
                    type="button"
                    onClick={() => { flow.update({ place: { lat: c.lat, lon: c.lon, label: cityName(c) } }); setQuery(cityName(c)); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper focus-visible:bg-paper"
                  >
                    <MapPin aria-hidden="true" className="text-muted" /> {cityName(c)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q && !matches.length && !place && <p className="type-small text-muted">{t.home.noCity}</p>}
          <Button variant="secondary" type="button" onClick={locate} loading={geo === "busy"} icon={<MapPin size={20} aria-hidden="true" />} className="self-start">
            {geo === "busy" ? t.home.locating : t.home.useLocation}
          </Button>
          <p id="city-status" aria-live="polite" className="type-small">
            {place ? (
              <span className="flex items-center gap-1.5 text-good"><CheckCircle weight="fill" aria-hidden="true" /> {t.home.located(place.label)}</span>
            ) : geo === "failed" ? (
              <span className="text-bad">{t.home.geoFailed}</span>
            ) : geo === "outside" ? (
              <span className="text-bad">{t.home.outsideIndia}</span>
            ) : submitted ? (
              <span className="text-bad">{t.home.needPlace}</span>
            ) : null}
          </p>
        </section>

        <section className="col-span-7 flex flex-col gap-4">
          <fieldset>
            <legend className="type-h3">{t.home.roof}</legend>
            <p className="mt-1 type-small text-muted">{t.home.roofHelp}</p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              {(["small", "medium", "large", "unknown"] as Roof[]).map((r) => {
                const on = roof === r && !noRoof;
                return (
                  <label
                    key={r}
                    className={`flex items-center gap-5 rounded-[var(--radius-panel)] border-2 bg-surface p-5 transition-[border-color,box-shadow] duration-150 ${
                      on ? "border-ink shadow-[var(--shadow-panel)]" : "border-line hover:border-ink/40"
                    }`}
                  >
                    <input type="radio" name="roof" value={r} checked={on} onChange={() => { setNoRoof(false); flow.update({ roof: r }); }} className="sr-only" />
                    <RoofSketch roof={r} on={on} />
                    <span className="flex flex-col">
                      <span className="font-semibold">{t.home.roofs[r][0]}</span>
                      <span className="type-small text-muted">{t.home.roofs[r][1]}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <label className="flex items-center gap-3 self-start rounded-lg px-1 py-2">
            <input type="checkbox" checked={noRoof} onChange={(e) => setNoRoof(e.target.checked)} className="size-5 accent-[#14213d]" />
            {t.home.noRoof}
          </label>
          {noRoof ? (
            <p className="flex items-start gap-2 rounded-[var(--radius-input)] bg-warn-soft px-4 py-3 text-warn">
              <Info size={20} className="mt-0.5 shrink-0" aria-hidden="true" /> {t.home.noRoofText}
            </p>
          ) : (
            <p className="flex items-start gap-2 type-small text-muted">
              <Info className="mt-1 shrink-0" aria-hidden="true" /> {t.home.assumption}
            </p>
          )}
          {submitted && !roof && !noRoof && <p className="type-small text-bad">{t.home.needRoof}</p>}
                    {roof && roof !== "unknown" && !noRoof && <Roof3D key={roof} roof={roof} />}
        </section>
      </div>

      <div className="mt-12 flex items-center gap-5 border-t border-line pt-8">
        <Button onClick={submit} loading={busy} disabled={noRoof}>
          {busy ? t.home.preparing : t.home.submit}
        </Button>
        {error && (
          <p role="alert" className="flex items-center gap-2 text-bad">
            <WarningCircle weight="bold" aria-hidden="true" /> {error}
          </p>
        )}
        {busy && <Spinner className="sr-only" />}
      </div>
    </div>
  );
}

/** Roof area drawn to scale next to a parked car (about 135 sq ft), so the sizes mean something. */
function RoofSketch({ roof, on }: { roof: Roof; on: boolean }) {
  const stroke = on ? "#14213d" : "#a9b0a4";
  if (roof === "unknown") {
    return (
      <svg viewBox="0 0 64 64" className="size-16 shrink-0" aria-hidden="true">
        <rect x="8" y="8" width="48" height="48" rx="4" fill="none" stroke={stroke} strokeWidth="2" strokeDasharray="5 4" />
        <text x="32" y="41" textAnchor="middle" fontSize="24" fontWeight="700" fill={stroke}>?</text>
      </svg>
    );
  }
  const side = Math.sqrt(ROOF_SQFT[roof]) * 2.2; // px per sqrt(sq ft)
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0" aria-hidden="true">
      <rect x={32 - side / 2} y={32 - side / 2} width={side} height={side} rx="2" fill={on ? "#fff4d6" : "#f8f9f6"} stroke={stroke} strokeWidth="2" />
      <rect x="27" y="22" width="10" height="20" rx="3" fill={stroke} opacity="0.8" />
    </svg>
  );
}
