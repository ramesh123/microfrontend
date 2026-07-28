export interface LocationValue {
  lat: number;
  lng: number;
  label: string;
}

const DEFAULT_LOCATION: LocationValue = {
  lat: 20.5937,
  lng: 78.9629,
  label: '',
};

export function parseLocationValue(raw: string | undefined | null): LocationValue | null {
  if (!raw?.trim()) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<LocationValue>;
    if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
      return {
        lat: parsed.lat,
        lng: parsed.lng,
        label: typeof parsed.label === 'string' ? parsed.label : '',
      };
    }
  } catch {
    const parts = raw.split('|');
    const coords = parts[0]?.split(',').map((part) => Number(part.trim()));
    if (coords.length === 2 && coords.every((num) => Number.isFinite(num))) {
      return { lat: coords[0], lng: coords[1], label: parts[1]?.trim() ?? '' };
    }
  }

  return null;
}

export function serializeLocationValue(location: LocationValue): string {
  return JSON.stringify(location);
}

export function formatLocationLabel(location: LocationValue): string {
  if (location.label.trim()) return location.label;
  return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
}

export function getDefaultMapLocation(): LocationValue {
  return { ...DEFAULT_LOCATION };
}

export async function searchLocations(query: string): Promise<LocationValue[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=6&language=en&format=json`,
  );

  if (!response.ok) return [];

  const data = (await response.json()) as {
    results?: Array<{
      latitude: number;
      longitude: number;
      name: string;
      admin1?: string;
      country?: string;
    }>;
  };

  return (data.results ?? []).map((result) => ({
    lat: result.latitude,
    lng: result.longitude,
    label: [result.name, result.admin1, result.country].filter(Boolean).join(', '),
  }));
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const response = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
  );

  if (!response.ok) {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  const data = (await response.json()) as {
    locality?: string;
    city?: string;
    principalSubdivision?: string;
    countryName?: string;
  };

  return [data.locality ?? data.city, data.principalSubdivision, data.countryName].filter(Boolean).join(', ')
    || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60_000,
    });
  });
}
