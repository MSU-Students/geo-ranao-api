import { BadRequestException } from '@nestjs/common';

// GeoJSON Point — the shape TypeORM's Postgres driver expects on write and
// returns on read for geometry/geography columns (it wraps inserts in
// ST_GeomFromGeoJSON and reads back via ST_AsGeoJSON automatically). Per the
// GeoJSON spec, coordinate order is always [lng, lat] — never [lat, lng].
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

export function toGeoPoint(lat: number, lng: number): GeoPoint {
  return { type: 'Point', coordinates: [lng, lat] };
}

export function latOf(point: GeoPoint): number {
  return point.coordinates[1];
}

export function lngOf(point: GeoPoint): number {
  return point.coordinates[0];
}

// Parses the "lat, lng" free-text format the fish-observations form submits
// (validated with @IsLatLong() before this ever runs) into a GeoPoint.
export function parseLatLngString(value: string): GeoPoint {
  const [latStr, lngStr] = value.split(',').map((part) => part.trim());
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new BadRequestException(`Invalid coordinates "${value}" — expected "lat, lng"`);
  }
  return toGeoPoint(lat, lng);
}

export function formatLatLngString(point: GeoPoint): string {
  return `${latOf(point)}, ${lngOf(point)}`;
}
