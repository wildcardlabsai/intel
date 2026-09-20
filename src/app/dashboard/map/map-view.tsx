"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Map as MapLibreMap, Marker, NavigationControl } from "maplibre-gl";

import { Badge, Card, CardContent } from "@/components/ui/primitives";

/**
 * MapLibre map of located records.
 *
 * MapLibre needs no API key. Without NEXT_PUBLIC_MAP_STYLE_URL there are no
 * basemap tiles, so the map renders markers on a plain background and says so
 * — it does not silently look broken.
 */

export type MapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  subtitle: string | null;
  href: string;
};

export type MapLayer = {
  key: string;
  label: string;
  colour: string;
  markers: MapMarker[];
};

// Roughly the bounding box of Wales.
const WALES_BOUNDS: [[number, number], [number, number]] = [
  [-5.5, 51.3],
  [-2.6, 53.5],
];

const EMPTY_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background" as const,
      paint: { "background-color": "#e7e9dd" },
    },
  ],
};

export function WalesMapView({
  layers,
  styleUrl,
}: {
  layers: MapLayer[];
  styleUrl: string | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<Marker[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(layers.map((layer) => [layer.key, true]))
  );
  const [selected, setSelected] = useState<MapMarker | null>(null);

  useEffect(() => {
    if (!container.current || map.current) return;

    map.current = new MapLibreMap({
      container: container.current,
      style: styleUrl ?? EMPTY_STYLE,
      bounds: WALES_BOUNDS,
      fitBoundsOptions: { padding: 40 },
      attributionControl: { compact: true },
    });

    map.current.addControl(new NavigationControl({ showCompass: false }), "top-right");

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [styleUrl]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;

    for (const marker of markerRefs.current) marker.remove();
    markerRefs.current = [];

    for (const layer of layers) {
      if (!enabled[layer.key]) continue;

      for (const point of layer.markers) {
        const element = document.createElement("button");
        element.type = "button";
        element.setAttribute("aria-label", point.title);
        element.style.cssText = `width:10px;height:10px;border-radius:9999px;background:${layer.colour};border:1.5px solid #FCFBF7;cursor:pointer;`;
        element.addEventListener("click", () => setSelected(point));

        const marker = new Marker({ element })
          .setLngLat([point.longitude, point.latitude])
          .addTo(instance);

        markerRefs.current.push(marker);
      }
    }
  }, [layers, enabled]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {layers.map((layer) => (
          <button
            key={layer.key}
            type="button"
            onClick={() =>
              setEnabled((current) => ({ ...current, [layer.key]: !current[layer.key] }))
            }
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              enabled[layer.key]
                ? "border-green-900 bg-green-900 text-cream"
                : "border-border bg-white text-muted"
            }`}
            aria-pressed={enabled[layer.key]}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: enabled[layer.key] ? "#FCFBF7" : layer.colour }}
            />
            {layer.label} ({layer.markers.length})
          </button>
        ))}
      </div>

      {!styleUrl && (
        <p className="text-xs text-muted">
          No basemap configured — markers are shown on a plain background. Set{" "}
          <code className="font-mono">NEXT_PUBLIC_MAP_STYLE_URL</code> to add map tiles.
        </p>
      )}

      <div className="relative overflow-hidden rounded-xl border border-border">
        <div ref={container} className="h-[600px] w-full" />

        {selected && (
          <Card className="absolute bottom-4 left-4 right-4 z-10 max-w-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={selected.href}
                    className="block truncate font-semibold text-ink-900 hover:text-accent-green"
                  >
                    {selected.title}
                  </Link>
                  {selected.subtitle && (
                    <p className="mt-0.5 truncate text-xs text-muted">{selected.subtitle}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="shrink-0 text-xs text-muted hover:text-ink-900"
                  aria-label="Close"
                >
                  Close
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Badge tone="neutral">
        Only records with a postcode resolved to coordinates are plotted.
      </Badge>
    </div>
  );
}
