/**
 * British National Grid (OSGB36 / EPSG:27700) to WGS84 latitude and longitude.
 *
 * Welsh planning authorities that publish coordinates usually publish eastings
 * and northings, because that is what their GIS holds. Converting is a
 * two-step job: invert the Transverse Mercator projection to OSGB36
 * latitude/longitude, then apply a Helmert transformation to WGS84.
 *
 * This is the standard OS "A guide to coordinate systems in Great Britain"
 * method. The Helmert transform is accurate to a few metres, which is far
 * inside the precision a planning record carries anyway. It is not a
 * substitute for OSTN15 where centimetre accuracy matters — nothing here
 * needs that.
 */

const AIRY_1830 = { a: 6377563.396, b: 6356256.909 };
const GRS80 = { a: 6378137.0, b: 6356752.3141 };

// National Grid true origin and scale factor.
const F0 = 0.9996012717;
const LAT0 = deg2rad(49);
const LON0 = deg2rad(-2);
const E0 = 400000;
const N0 = -100000;

// OSGB36 → WGS84 Helmert parameters.
const HELMERT = {
  tx: 446.448,
  ty: -125.157,
  tz: 542.06,
  rx: 0.1502 / 3600,
  ry: 0.247 / 3600,
  rz: 0.8421 / 3600,
  s: -20.4894e-6,
};

function deg2rad(value: number): number {
  return (value * Math.PI) / 180;
}

function rad2deg(value: number): number {
  return (value * 180) / Math.PI;
}

export type LatLng = { latitude: number; longitude: number };

/**
 * Converts an easting/northing pair to WGS84.
 *
 * Returns null for coordinates outside the National Grid, rather than a
 * plausible-looking point somewhere in the sea — a record with a bad grid
 * reference should have no coordinates, not wrong ones.
 */
export function osgbToWgs84(easting: number, northing: number): LatLng | null {
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;
  // The National Grid covers 0–700000 E and 0–1300000 N.
  if (easting < 0 || easting > 700000 || northing < 0 || northing > 1300000) return null;

  const { a, b } = AIRY_1830;
  const e2 = 1 - (b * b) / (a * a);
  const n = (a - b) / (a + b);
  const n2 = n * n;
  const n3 = n2 * n;

  // Iterate northing back to a footpoint latitude.
  let lat = LAT0;
  let m = 0;

  for (let iteration = 0; iteration < 20; iteration += 1) {
    lat = (northing - N0 - m) / (a * F0) + lat;

    const deltaLat = lat - LAT0;
    const sumLat = lat + LAT0;

    m =
      b *
      F0 *
      ((1 + n + (5 / 4) * n2 + (5 / 4) * n3) * deltaLat -
        (3 * n + 3 * n2 + (21 / 8) * n3) * Math.sin(deltaLat) * Math.cos(sumLat) +
        ((15 / 8) * n2 + (15 / 8) * n3) * Math.sin(2 * deltaLat) * Math.cos(2 * sumLat) -
        (35 / 24) * n3 * Math.sin(3 * deltaLat) * Math.cos(3 * sumLat));

    if (Math.abs(northing - N0 - m) < 0.00001) break;
  }

  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const tanLat = Math.tan(lat);

  const nu = (a * F0) / Math.sqrt(1 - e2 * sinLat * sinLat);
  const rho = (a * F0 * (1 - e2)) / Math.pow(1 - e2 * sinLat * sinLat, 1.5);
  const eta2 = nu / rho - 1;

  const tan2 = tanLat * tanLat;
  const tan4 = tan2 * tan2;
  const tan6 = tan4 * tan2;
  const sec = 1 / cosLat;

  const vii = tanLat / (2 * rho * nu);
  const viii = (tanLat / (24 * rho * Math.pow(nu, 3))) * (5 + 3 * tan2 + eta2 - 9 * tan2 * eta2);
  const ix = (tanLat / (720 * rho * Math.pow(nu, 5))) * (61 + 90 * tan2 + 45 * tan4);
  const x = sec / nu;
  const xi = (sec / (6 * Math.pow(nu, 3))) * (nu / rho + 2 * tan2);
  const xii = (sec / (120 * Math.pow(nu, 5))) * (5 + 28 * tan2 + 24 * tan4);
  const xiia = (sec / (5040 * Math.pow(nu, 7))) * (61 + 662 * tan2 + 1320 * tan4 + 720 * tan6);

  const dE = easting - E0;
  const dE2 = dE * dE;

  const latOsgb = lat - vii * dE2 + viii * dE2 * dE2 - ix * dE2 * dE2 * dE2;
  const lonOsgb =
    LON0 + x * dE - xi * dE * dE2 + xii * dE * dE2 * dE2 - xiia * dE * dE2 * dE2 * dE2;

  return helmert(latOsgb, lonOsgb);
}

/** OSGB36 geodetic coordinates to WGS84, via Cartesian space. */
function helmert(latRad: number, lonRad: number): LatLng {
  const from = AIRY_1830;
  const to = GRS80;

  const e2From = 1 - (from.b * from.b) / (from.a * from.a);
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const nu = from.a / Math.sqrt(1 - e2From * sinLat * sinLat);

  const x1 = nu * cosLat * Math.cos(lonRad);
  const y1 = nu * cosLat * Math.sin(lonRad);
  const z1 = (1 - e2From) * nu * sinLat;

  const { tx, ty, tz, s } = HELMERT;
  const rx = deg2rad(HELMERT.rx);
  const ry = deg2rad(HELMERT.ry);
  const rz = deg2rad(HELMERT.rz);
  const scale = 1 + s;

  const x2 = tx + x1 * scale - y1 * rz + z1 * ry;
  const y2 = ty + x1 * rz + y1 * scale - z1 * rx;
  const z2 = tz - x1 * ry + y1 * rx + z1 * scale;

  const e2To = 1 - (to.b * to.b) / (to.a * to.a);
  const p = Math.sqrt(x2 * x2 + y2 * y2);

  let latTo = Math.atan2(z2, p * (1 - e2To));
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const nuTo = to.a / Math.sqrt(1 - e2To * Math.sin(latTo) * Math.sin(latTo));
    const next = Math.atan2(z2 + e2To * nuTo * Math.sin(latTo), p);
    if (Math.abs(next - latTo) < 1e-12) {
      latTo = next;
      break;
    }
    latTo = next;
  }

  return {
    latitude: Number(rad2deg(latTo).toFixed(7)),
    longitude: Number(rad2deg(Math.atan2(y2, x2)).toFixed(7)),
  };
}

/** True when a point is plausibly in or beside Wales. */
export function isPlausiblyWelshPoint({ latitude, longitude }: LatLng): boolean {
  return latitude >= 51.28 && latitude <= 53.45 && longitude >= -5.35 && longitude <= -2.6;
}
