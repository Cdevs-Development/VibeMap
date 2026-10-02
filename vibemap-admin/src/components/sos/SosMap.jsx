import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Phone } from 'lucide-react';

// Controller component to smoothly fly to the selected SOS location
const MapController = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] != null && center[1] != null) {
      const lat = parseFloat(center[0]);
      const lng = parseFloat(center[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        map.flyTo([lat, lng], 15, { duration: 1.5 });
      }
    }
  }, [center, map]);
  return null;
};

// Create a custom pulsing tactical icon for SOS Events
const createTacticalIcon = (sos) => {
  const color = '#ef4444'; // Rose-500 for alert
  const initial = sos?.user ? sos.user.charAt(0).toUpperCase() : 'U';

  const html = `
    <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
      <div style="position: relative; width: 36px; height: 36px;">
        <!-- Pulsing Rings -->
        <div style="position: absolute; inset: -8px; border-radius: 50%; border: 2px solid ${color}; opacity: 0.4; animation: pulse 2s ease-out infinite;"></div>
        <div style="position: absolute; inset: -4px; border-radius: 50%; border: 2px solid ${color}; opacity: 0.6; animation: pulse 2s ease-out infinite 0.5s;"></div>
        
        <!-- Center Badge -->
        <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(12,12,20,0.95); border: 2.5px solid ${color}; display: flex; align-items: center; justify-content: center; font-size: 16px; color: white; font-weight: bold; box-shadow: 0 0 16px ${color}; position: relative; z-index: 10;">
          ${initial}
        </div>
      </div>
      
      <!-- Name Pill -->
      <div style="background: rgba(12,12,20,0.9); border: 1px solid ${color}88; border-radius: 8px; padding: 2px 6px; color: #ffffff; font-size: 10px; font-weight: 600; white-space: nowrap; margin-top: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.7);">
        ${sos?.user || 'Unknown'}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-tactical-marker',
    iconSize: [40, 60],
    iconAnchor: [20, 30],
    popupAnchor: [0, -30]
  });
};

const SosMap = ({ sosList = [], selectedSos, setSelectedSosId }) => {
  return (
    <div className="w-full lg:w-7/12 h-[calc(100vh-8rem)] min-h-[400px] bg-ops-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm relative">
      <MapContainer 
        center={selectedSos ? [selectedSos.lat ?? 6.5244, selectedSos.lng ?? 3.3792] : [6.5244, 3.3792]} 
        zoom={11} 
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={true}
      >
        {/* Dark map tiles via MapTiler Streets v2 Dark (Matching MapScreen.jsx) */}
        <TileLayer
          url={`https://api.maptiler.com/maps/streets-v2-dark/256/{z}/{x}/{y}.png?key=${import.meta.env.VITE_MAPTILER_KEY}`}
          attribution='&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'
        />
        <MapController center={selectedSos ? [selectedSos.lat ?? 6.5244, selectedSos.lng ?? 3.3792] : null} />
        
        {sosList.map(sos => (
          <Marker 
            key={sos.id} 
            position={[sos?.lat ?? 6.5244, sos?.lng ?? 3.3792]}
            icon={createTacticalIcon(sos)}
            eventHandlers={{
              click: () => setSelectedSosId(sos?.id),
            }}
          >
            <Popup className="ops-popup">
              <div className="flex flex-col gap-1 text-slate-200 min-w-[200px]">
                <div className="font-bold text-base text-white">{sos?.user || 'Unknown User'}</div>
                <div className="flex items-center gap-2 text-sm text-slate-400 mt-2">
                  <Phone size={14} /> {sos?.phone || 'No Phone'}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Map Overlay Stats */}
      <div className="absolute top-4 right-4 z-[400] bg-ops-950/80 backdrop-blur border border-slate-800 rounded-lg p-3 text-xs shadow-lg">
        <div className="font-medium text-slate-300 mb-1">Tactical Map - Active View</div>
        <div className="flex gap-4 text-slate-400">
          <span>Lat: {selectedSos ? (selectedSos.lat ?? 6.5244).toFixed(4) : '6.5244'}</span>
          <span>Lng: {selectedSos ? (selectedSos.lng ?? 3.3792).toFixed(4) : '3.3792'}</span>
        </div>
      </div>
    </div>
  );
};

export default SosMap;
