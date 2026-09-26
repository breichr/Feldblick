import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ImportData } from '../data/imports';
import { colorForCode } from '../domain/colors';
import type { Schlag } from '../domain/types';

const ATTRIBUTION = 'Datenquelle: <a href="https://basemap.at" target="_blank" rel="noopener">basemap.at</a>';

export interface MapView {
  show(data: ImportData): void;
  focusSchlag(schlagId: string): void;
  /** Call after the container becomes visible or changes size. */
  refresh(): void;
}

export function createMapView(container: HTMLElement, onSelect: (schlag: Schlag) => void): MapView {
  const map = L.map(container, { zoomControl: true, attributionControl: true }).setView([47.6, 13.8], 7);

  const grundkarte = L.tileLayer(
    'https://mapsneu.wien.gv.at/basemap/geolandbasemap/normal/google3857/{z}/{y}/{x}.png',
    { maxNativeZoom: 19, maxZoom: 20, attribution: ATTRIBUTION },
  );
  const orthofoto = L.tileLayer(
    'https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg',
    { maxNativeZoom: 19, maxZoom: 20, attribution: ATTRIBUTION },
  );
  orthofoto.addTo(map);
  L.control.layers({ Orthofoto: orthofoto, Grundkarte: grundkarte }, undefined, { position: 'topright' }).addTo(map);

  const schlagLayers = new Map<string, L.GeoJSON>();
  let content: L.FeatureGroup | undefined;
  let highlighted: L.GeoJSON | undefined;
  let pendingFit: L.LatLngBounds | undefined;

  function fit(bounds: L.LatLngBounds, maxZoom = 18) {
    if (container.offsetWidth === 0) {
      pendingFit = bounds; // hidden: fit once it is shown
      return;
    }
    map.fitBounds(bounds, { padding: [24, 24], maxZoom });
  }

  function highlight(layer: L.GeoJSON | undefined) {
    highlighted?.setStyle({ weight: 1.5, color: '#1b1b1b' });
    highlighted = layer;
    layer?.setStyle({ weight: 4, color: '#ffea00' });
    layer?.bringToFront();
  }

  return {
    show({ feldstuecke, schlaege }) {
      content?.remove();
      schlagLayers.clear();
      highlighted = undefined;
      content = L.featureGroup().addTo(map);

      for (const s of schlaege) {
        const fill = colorForCode(s.nutzungsart.code);
        const layer = L.geoJSON(s.geometry, {
          style: { color: '#1b1b1b', weight: 1.5, fillColor: fill, fillOpacity: 0.55 },
        });
        layer.bindTooltip(`${s.nutzungsart.bezeichnung}`, { sticky: true });
        layer.on('click', () => {
          highlight(layer);
          onSelect(s);
        });
        layer.addTo(content);
        schlagLayers.set(s.id, layer);
      }
      for (const fs of feldstuecke) {
        L.geoJSON(fs.geometry, {
          interactive: false,
          style: { color: '#ffffff', weight: 3, fill: false },
        }).addTo(content);
      }

      const bounds = content.getBounds();
      if (bounds.isValid()) fit(bounds);
    },

    focusSchlag(schlagId) {
      const layer = schlagLayers.get(schlagId);
      if (!layer) return;
      highlight(layer);
      fit(layer.getBounds(), 17);
    },

    refresh() {
      map.invalidateSize();
      if (pendingFit) {
        map.fitBounds(pendingFit, { padding: [24, 24], maxZoom: 18 });
        pendingFit = undefined;
      }
    },
  };
}
