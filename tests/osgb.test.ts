import { describe, expect, it } from "vitest";

import { isPlausiblyWelshPoint, osgbToWgs84 } from "@/lib/geo/osgb";

/**
 * Checked against Ordnance Survey's own published worked example and against
 * the grid references OS publishes for well-known Welsh places.
 */
describe("osgbToWgs84", () => {
  it("matches the Ordnance Survey worked example at Caister Water Tower", () => {
    // OS "A guide to coordinate systems in Great Britain", test point:
    // E 651409.903, N 313177.270 → 52.6575703 N, 1.7166810 E (OSGB36).
    // After the Helmert shift to WGS84 this lands within a few metres.
    const result = osgbToWgs84(651409.903, 313177.27)!;
    expect(result.latitude).toBeCloseTo(52.657977, 3);
    expect(result.longitude).toBeCloseTo(1.716038, 3);
  });

  it("places Cardiff city centre in Cardiff", () => {
    // ST 18174 76439 — Cardiff Castle.
    const result = osgbToWgs84(318174, 176439)!;
    expect(result.latitude).toBeCloseTo(51.482, 2);
    expect(result.longitude).toBeCloseTo(-3.181, 2);
    expect(isPlausiblyWelshPoint(result)).toBe(true);
  });

  it("places Caernarfon in North Wales", () => {
    // SH 47723 62685 — Caernarfon Castle.
    const result = osgbToWgs84(247723, 362685)!;
    expect(result.latitude).toBeCloseTo(53.139, 2);
    expect(result.longitude).toBeCloseTo(-4.277, 2);
    expect(isPlausiblyWelshPoint(result)).toBe(true);
  });

  it("returns nothing for a reference outside the National Grid", () => {
    // A bad grid reference must produce no coordinates, not a point at sea.
    expect(osgbToWgs84(-1, 200000)).toBeNull();
    expect(osgbToWgs84(900000, 200000)).toBeNull();
    expect(osgbToWgs84(300000, 2000000)).toBeNull();
  });

  it("returns nothing for values that are not numbers", () => {
    expect(osgbToWgs84(Number.NaN, 200000)).toBeNull();
    expect(osgbToWgs84(300000, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("isPlausiblyWelshPoint", () => {
  it("accepts points in Wales", () => {
    expect(isPlausiblyWelshPoint({ latitude: 51.48, longitude: -3.18 })).toBe(true);
    expect(isPlausiblyWelshPoint({ latitude: 53.28, longitude: -4.3 })).toBe(true);
  });

  it("rejects points well outside Wales", () => {
    expect(isPlausiblyWelshPoint({ latitude: 51.5, longitude: -0.12 })).toBe(false);
    expect(isPlausiblyWelshPoint({ latitude: 55.95, longitude: -3.19 })).toBe(false);
  });
});
