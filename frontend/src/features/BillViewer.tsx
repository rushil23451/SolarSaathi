import { useState } from "react";
import { ArrowsIn, MagnifyingGlassMinus, MagnifyingGlassPlus } from "@phosphor-icons/react";
import { useT } from "../i18n";

/** The person's own bill beside the fields, so they can compare without holding the paper. */
export function BillViewer({ url, type }: { url: string; type: string }) {
  const t = useT();
  const [zoom, setZoom] = useState(1);
  const btn = "grid size-10 place-items-center rounded-full bg-surface/95 text-ink shadow-[var(--shadow-panel)] hover:bg-paper disabled:opacity-40";
  if (type === "application/pdf") {
    return <iframe src={url} title={t.check.viewer.title} className="h-[calc(100dvh-180px)] min-h-[560px] w-full rounded-[var(--radius-panel)] border border-line bg-surface" />;
  }
  return (
    <figure className="relative overflow-hidden rounded-[var(--radius-panel)] border border-line bg-[#eef0eb]">
      <div className="h-[calc(100dvh-180px)] min-h-[560px] overflow-auto overscroll-contain" tabIndex={0} aria-label={t.check.viewer.title}>
        <img
          src={url}
          alt={t.check.viewer.title}
          className="origin-top-left transition-[width] duration-200"
          style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
        />
      </div>
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button className={btn} onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1} aria-label={t.check.viewer.zoomOut}>
          <MagnifyingGlassMinus size={20} aria-hidden="true" />
        </button>
        <button className={btn} onClick={() => setZoom(1)} disabled={zoom === 1} aria-label={t.check.viewer.fit}>
          <ArrowsIn size={20} aria-hidden="true" />
        </button>
        <button className={btn} onClick={() => setZoom((z) => Math.min(3, z + 0.5))} disabled={zoom >= 3} aria-label={t.check.viewer.zoomIn}>
          <MagnifyingGlassPlus size={20} aria-hidden="true" />
        </button>
      </div>
    </figure>
  );
}
