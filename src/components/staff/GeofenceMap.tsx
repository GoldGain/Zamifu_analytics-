import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface GeofenceMapProps {
  latitude: number | null;
  longitude: number | null;
  radius: number;
  onChange?: (latitude: number, longitude: number) => void;
  interactive?: boolean;
  height?: number;
  className?: string;
}

const DEFAULT_CENTER: [number, number] = [-4.0435, 39.6682]; // Mombasa, Kenya

const pinIcon = L.divIcon({
  className: 'zamifu-geofence-pin',
  html: `<div style="position:relative;width:30px;height:38px;">
      <div style="position:absolute;left:4px;top:0;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#2563EB;border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>
      <div style="position:absolute;left:11px;top:7px;width:8px;height:8px;border-radius:50%;background:#ffffff;"></div>
      <div style="position:absolute;left:13px;top:22px;width:4px;height:12px;background:#2563EB;border-radius:0 0 2px 2px;box-shadow:0 2px 4px rgba(0,0,0,0.25);"></div>
    </div>`,
  iconSize: [30, 38],
  iconAnchor: [15, 36],
});

export default function GeofenceMap({
  latitude,
  longitude,
  radius,
  onChange,
  interactive = true,
  height = 380,
  className = '',
}: GeofenceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  const initialRef = useRef({ latitude, longitude, radius });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Initialise once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const { latitude: lat, longitude: lng } = initialRef.current;
    const hasPin = lat !== null && lng !== null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
    const center: [number, number] = hasPin ? [Number(lat), Number(lng)] : DEFAULT_CENTER;

    const map = L.map(containerRef.current, {
      center,
      zoom: hasPin ? 17 : 12,
      zoomControl: true,
      scrollWheelZoom: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    if (hasPin) {
      markerRef.current = L.marker(center, { icon: pinIcon, draggable: true, keyboard: false }).addTo(map);
      markerRef.current.on('dragend', () => {
        const position = markerRef.current?.getLatLng();
        if (!position) return;
        circleRef.current?.setLatLng(position);
        onChangeRef.current?.(position.lat, position.lng);
      });
      circleRef.current = L.circle(center, {
        radius: Math.max(Number(initialRef.current.radius) || 100, 1),
        color: '#2563EB',
        weight: 2,
        fillColor: '#2563EB',
        fillOpacity: 0.12,
      }).addTo(map);
    }

    if (interactive) {
      map.on('click', (event: L.LeafletMouseEvent) => {
        const { lat, lng } = event.latlng;
        if (!markerRef.current) {
          markerRef.current = L.marker([lat, lng], { icon: pinIcon, draggable: true, keyboard: false }).addTo(map);
          markerRef.current.on('dragend', () => {
            const position = markerRef.current?.getLatLng();
            if (!position) return;
            circleRef.current?.setLatLng(position);
            onChangeRef.current?.(position.lat, position.lng);
          });
        } else {
          markerRef.current.setLatLng([lat, lng]);
        }
        if (!circleRef.current) {
          circleRef.current = L.circle([lat, lng], {
            radius: Math.max(Number(initialRef.current.radius) || 100, 1),
            color: '#2563EB',
            weight: 2,
            fillColor: '#2563EB',
            fillOpacity: 0.12,
          }).addTo(map);
        } else {
          circleRef.current.setLatLng([lat, lng]);
        }
        onChangeRef.current?.(lat, lng);
      });
    }

    // Leaflet needs a nudge when it is mounted inside a responsive card.
    const invalidate = () => map.invalidateSize();
    const frame = window.requestAnimationFrame(invalidate);
    const timer = window.setTimeout(invalidate, 250);
    window.addEventListener('resize', invalidate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener('resize', invalidate);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep marker/circle in sync with controlled inputs.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const hasPin = latitude !== null && longitude !== null && !Number.isNaN(Number(latitude)) && !Number.isNaN(Number(longitude));
    if (!hasPin) return;
    const position: [number, number] = [Number(latitude), Number(longitude)];

    if (!markerRef.current) {
      markerRef.current = L.marker(position, { icon: pinIcon, draggable: true, keyboard: false }).addTo(map);
      markerRef.current.on('dragend', () => {
        const next = markerRef.current?.getLatLng();
        if (!next) return;
        circleRef.current?.setLatLng(next);
        onChangeRef.current?.(next.lat, next.lng);
      });
    } else {
      markerRef.current.setLatLng(position);
    }

    if (!circleRef.current) {
      circleRef.current = L.circle(position, {
        radius: Math.max(Number(radius) || 100, 1),
        color: '#2563EB',
        weight: 2,
        fillColor: '#2563EB',
        fillOpacity: 0.12,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(position);
      circleRef.current.setRadius(Math.max(Number(radius) || 100, 1));
    }

    map.setView(position, Math.max(map.getZoom(), 16), { animate: false });
  }, [latitude, longitude, radius]);

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100 ${className}`}
      style={{ height }}
      role="application"
      aria-label="School geofence map. Click to set the school location."
    />
  );
}
