import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Loader2, LocateFixed, MapPin, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  formatLocationLabel,
  getCurrentPosition,
  getDefaultMapLocation,
  parseLocationValue,
  reverseGeocode,
  searchLocations,
  serializeLocationValue,
  type LocationValue,
} from '../../lib/location/location.utils';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const defaultMarkerIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = defaultMarkerIcon;

interface LocationPickerProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  variant?: 'default' | 'canvas' | 'runtime';
}

export function LocationPicker({
  value = '',
  onChange,
  disabled = false,
  placeholder = 'Search city, address, or place',
  variant = 'default',
}: LocationPickerProps) {
  const compact = variant === 'canvas';
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const parsedInitialLocation = parseLocationValue(value);
  const mapInitialLocationRef = useRef(parsedInitialLocation ?? getDefaultMapLocation());
  const hasInitialLocationRef = useRef(parsedInitialLocation !== null);
  const skipExternalSyncRef = useRef(false);
  const disabledRef = useRef(disabled);

  const parsed = parseLocationValue(value);
  const [searchQuery, setSearchQuery] = useState(parsed?.label ?? '');
  const [searchResults, setSearchResults] = useState<LocationValue[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationValue | null>(parsed);

  disabledRef.current = disabled;

  const emitLocation = useCallback(
    (location: LocationValue) => {
      skipExternalSyncRef.current = true;
      setSelectedLocation(location);
      setSearchQuery(location.label);
      setSearchResults([]);
      onChange?.(serializeLocationValue(location));
    },
    [onChange],
  );

  const updateMarkerRef = useRef<(lat: number, lng: number, label?: string) => Promise<void>>(async () => {});

  updateMarkerRef.current = async (lat: number, lng: number, label?: string) => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], Math.max(map.getZoom(), compact ? 12 : 13));

    const resolvedLabel = label ?? (await reverseGeocode(lat, lng));
    emitLocation({ lat, lng, label: resolvedLabel });
  };

  useEffect(() => {
    if (skipExternalSyncRef.current) {
      skipExternalSyncRef.current = false;
      return;
    }

    const next = parseLocationValue(value);
    setSelectedLocation(next);
    setSearchQuery(next?.label ?? '');

    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !next) return;

    marker.setLatLng([next.lat, next.lng]);
    map.setView([next.lat, next.lng], Math.max(map.getZoom(), compact ? 12 : 13));
  }, [compact, value]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    const initial = mapInitialLocationRef.current;
    const map = L.map(container, {
      center: [initial.lat, initial.lng],
      zoom: hasInitialLocationRef.current ? 13 : 5,
      zoomControl: !compact,
      attributionControl: !compact,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const marker = L.marker([initial.lat, initial.lng], { draggable: !disabledRef.current }).addTo(map);

    map.on('click', (event) => {
      if (disabledRef.current) return;
      void updateMarkerRef.current(event.latlng.lat, event.latlng.lng);
    });

    marker.on('dragend', () => {
      if (disabledRef.current) return;
      const position = marker.getLatLng();
      void updateMarkerRef.current(position.lat, position.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [compact]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    if (disabled) {
      marker.dragging?.disable();
    } else {
      marker.dragging?.enable();
    }
  }, [disabled]);

  const handleSearch = async () => {
    if (disabled || searchQuery.trim().length < 2) return;

    setIsSearching(true);
    try {
      const results = await searchLocations(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        toast.message('No locations found', { description: 'Try a different search term.' });
      }
    } catch {
      toast.error('Could not search locations');
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    if (disabled) return;

    setIsLocating(true);
    try {
      const position = await getCurrentPosition();
      await updateMarkerRef.current(position.coords.latitude, position.coords.longitude);
      toast.success('Current location selected');
    } catch {
      toast.error('Could not access your location. Allow location permission and try again.');
    } finally {
      setIsLocating(false);
    }
  };

  const stopBubble = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <div className="space-y-2" onClick={stopBubble} onPointerDown={stopBubble}>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            value={searchQuery}
            disabled={disabled}
            placeholder={placeholder}
            className={cn('h-8 pr-8', compact && 'h-8 !text-xs')}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleSearch();
              }
            }}
          />
          <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-text-muted" />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isSearching}
          className={cn('shrink-0', compact ? '!h-8 px-2 text-[10px]' : 'h-8')}
          onClick={() => void handleSearch()}
        >
          {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
        </Button>
      </div>

      {searchResults.length > 0 && (
        <div className="max-h-28 overflow-y-auto rounded-md border border-gray-border bg-background">
          {searchResults.map((result) => (
            <button
              key={`${result.lat}-${result.lng}-${result.label}`}
              type="button"
              disabled={disabled}
              className="flex w-full items-start gap-2 border-b border-gray-border/60 px-2.5 py-2 text-left text-xs last:border-b-0 hover:bg-gray-surface-hover disabled:opacity-50"
              onClick={() => {
                void updateMarkerRef.current(result.lat, result.lng, result.label);
              }}
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="text-gray-text">{result.label}</span>
            </button>
          ))}
        </div>
      )}

      <div
        ref={mapContainerRef}
        className={cn(
          'z-0 w-full overflow-hidden rounded-md border border-gray-border',
          compact ? 'h-28' : 'h-44',
          disabled && 'pointer-events-none opacity-60',
        )}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('min-w-0 truncate text-gray-text-muted', compact ? 'text-[10px]' : 'text-xs')}>
          {selectedLocation
            ? formatLocationLabel(selectedLocation)
            : 'Click the map, search, or use your current location'}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || isLocating}
          className={cn('shrink-0 gap-1.5', compact ? 'h-6 px-1.5 text-[10px]' : 'h-7 text-xs')}
          onClick={() => void handleUseCurrentLocation()}
        >
          {isLocating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <LocateFixed className="h-3 w-3" />
          )}
          My location
        </Button>
      </div>
    </div>
  );
}
