import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair, ExternalLink, LocateFixed, MapPin, Navigation, RotateCcw } from 'lucide-react'
import type { NearbyBusiness, QueueState } from './types'

const KEMANG: [number, number] = [-6.2603, 106.8192]
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

declare global { interface Window { google?: any } }

function distanceKm(from: [number, number], to: [number, number]) {
  const rad = (n: number) => n * Math.PI / 180
  const [lat1, lon1] = from
  const [lat2, lon2] = to
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function markerIcon(business: NearbyBusiness) {
  const color = business.live ? business.kind === 'car-wash' ? '#147d9a' : '#0f766e' : '#8fa89f'
  const label = business.kind === 'car-wash' ? '🚙' : business.kind === 'barber' ? '✂' : '•'
  return L.divIcon({ className: 'qease-map-marker-wrap', html: `<span class="qease-map-marker" style="--marker:${color}">${label}</span>`, iconSize: [36, 44], iconAnchor: [18, 42] })
}

export function NearbyMap({ businesses, states }: { businesses: NearbyBusiness[]; states: Partial<Record<string, QueueState>> }) {
  const element = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const googleMapRef = useRef<any>(null)
  const googleMarkersRef = useRef<any[]>([])
  const modeRef = useRef<'leaflet' | 'google' | null>(null)
  const [location, setLocation] = useState<[number, number] | null>(null)
  const [message, setMessage] = useState('Interactive Kemang map · location is optional')
  const [provider, setProvider] = useState<'loading' | 'leaflet' | 'google'>('loading')

  useEffect(() => {
    if (!element.current) return
    let cancelled = false
    const useLeaflet = () => {
      if (cancelled || !element.current) return
      const map = L.map(element.current, { zoomControl: false, attributionControl: true }).setView(KEMANG, 15)
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map)
      mapRef.current = map; layerRef.current = L.layerGroup().addTo(map); modeRef.current = 'leaflet'; setProvider('leaflet')
    }
    const useGoogle = async () => {
      if (!GOOGLE_MAPS_KEY) return useLeaflet()
      try {
        if (!window.google?.maps) await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector('script[data-qease-google-maps]') as HTMLScriptElement | null
          if (existing) { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', () => reject(new Error('Google Maps could not load')), { once: true }); return }
          const script = document.createElement('script'); script.dataset.qeaseGoogleMaps = 'true'; script.async = true; script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}`; script.onload = () => resolve(); script.onerror = () => reject(new Error('Google Maps could not load')); document.head.appendChild(script)
        })
        if (cancelled || !element.current || !window.google?.maps) return
        googleMapRef.current = new window.google.maps.Map(element.current, { center: { lat: KEMANG[0], lng: KEMANG[1] }, zoom: 15, fullscreenControl: false, streetViewControl: false, mapTypeControl: false, zoomControl: false, clickableIcons: false })
        modeRef.current = 'google'; setProvider('google'); setMessage('Google Maps is active · location is optional')
      } catch { setMessage('Google Maps was unavailable, so QEase is using OpenStreetMap.'); useLeaflet() }
    }
    void useGoogle()
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; layerRef.current = null; googleMarkersRef.current.forEach((marker) => marker.setMap?.(null)); googleMarkersRef.current = [] }
  }, [])

  useEffect(() => {
    if (provider === 'loading') return
    const layer = layerRef.current
    if (modeRef.current === 'leaflet' && layer) layer.clearLayers()
    googleMarkersRef.current.forEach((marker) => marker.setMap?.(null)); googleMarkersRef.current = []
    const popupHtml = (business: NearbyBusiness) => {
      const live = states[business.slug]
      const waiting = live?.tickets.filter((ticket) => ['waiting', 'return-soon', 'called'].includes(ticket.status)).length
      const distance = location ? distanceKm(location, [business.latitude, business.longitude]) : null
      const directions = `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`
      const status = business.live ? `<span class="map-popup-live">● Live on QEase</span>` : '<span class="map-popup-soon">Coming soon</span>'
      const queue = business.live ? `<p>${waiting ?? 0} in queue${distance !== null ? ` · ${distance < 1 ? Math.round(distance * 1000) + ' m' : distance.toFixed(1) + ' km'} away` : ''}</p>` : `<p>${distance !== null ? `${distance < 1 ? Math.round(distance * 1000) + ' m' : distance.toFixed(1) + ' km'} away` : 'Not live yet'}</p>`
      const actions = business.live ? `<a class="map-popup-queue" href="/q/${business.slug}">View queue</a>` : ''
      return `<div class="qease-map-popup"><b>${business.name}</b><small>${business.category}</small>${status}${queue}<div>${actions}<a class="map-popup-directions" href="${directions}" target="_blank" rel="noreferrer">Directions ↗</a></div></div>`
    }
    businesses.forEach((business) => {
      if (modeRef.current === 'leaflet' && layer) L.marker([business.latitude, business.longitude], { icon: markerIcon(business), title: business.name }).bindPopup(popupHtml(business)).addTo(layer)
      if (modeRef.current === 'google' && googleMapRef.current && window.google?.maps) {
        const color = business.live ? business.kind === 'car-wash' ? '#147d9a' : '#0f766e' : '#8fa89f'
        const marker = new window.google.maps.Marker({ map: googleMapRef.current, position: { lat: business.latitude, lng: business.longitude }, title: business.name, icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: business.live ? 10 : 7, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 } })
        const info = new window.google.maps.InfoWindow({ content: popupHtml(business) }); marker.addListener('click', () => info.open({ map: googleMapRef.current, anchor: marker })); googleMarkersRef.current.push(marker)
      }
    })
    if (location && modeRef.current === 'leaflet' && layer) L.circleMarker(location, { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).bindTooltip('Your approximate location').addTo(layer)
    if (location && modeRef.current === 'google' && googleMapRef.current && window.google?.maps) {
      const marker = new window.google.maps.Marker({ map: googleMapRef.current, position: { lat: location[0], lng: location[1] }, title: 'Your approximate location', icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#2563eb', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 } }); googleMarkersRef.current.push(marker)
    }
  }, [businesses, states, location, provider])

  const locate = () => {
    if (!navigator.geolocation) { setMessage('Location is not available in this browser.'); return }
    setMessage('Finding your approximate location…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { const next: [number, number] = [coords.latitude, coords.longitude]; setLocation(next); mapRef.current?.setView(next, 15); googleMapRef.current?.setCenter({ lat: next[0], lng: next[1] }); googleMapRef.current?.setZoom(15); setMessage('Showing distances from your current location.') },
      () => setMessage('Location permission was not granted. You can still explore the map.'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  return <div className="interactive-map-shell">
    <div ref={element} className="interactive-map" aria-label="Interactive map of nearby QEase businesses" />
    <div className="map-overlay-title"><MapPin size={15} /><span>Kemang, Jakarta</span></div>
    <div className="map-overlay-controls">
      <button type="button" onClick={locate}><LocateFixed size={16} /> Use my location</button>
      <button type="button" onClick={() => { mapRef.current?.setView(KEMANG, 15); googleMapRef.current?.setCenter({ lat: KEMANG[0], lng: KEMANG[1] }); googleMapRef.current?.setZoom(15); setMessage('Map recentered on Kemang.') }} aria-label="Recenter map"><RotateCcw size={16} /></button>
    </div>
    <div className="map-overlay-note"><Crosshair size={13} />{message}</div>
  </div>
}

export function DirectionsLink({ latitude, longitude }: { latitude: number; longitude: number }) {
  return <a className="directions-link" href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`} target="_blank" rel="noreferrer"><Navigation size={15} /> Directions <ExternalLink size={13} /></a>
}
