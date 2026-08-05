import { Circle, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect, useState } from "react";
import { MapPinned } from "../components/icons";
import { api } from "../api";
import EmptyState from "../components/EmptyState";

function Fit({ items }) {
  const map = useMap();

  useEffect(() => {
    if (!items.length) return;
    const bounds = items.map((x) => [x.lat, x.lng]);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 11 });
  }, [items, map]);

  return null;
}

export default function Territories() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.territories().then(setItems).finally(() => setLoading(false));
  }, []);

  return (
    <div className="territory-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Territory intelligence</span>
          <h1>Your targeted-market map</h1>
          <p>
            Colored areas show where you have already targeted. Select an area to see
            its niche and discovered leads.
          </p>
        </div>

        <div className="legend">
          <i /> Targeted territory
        </div>
      </div>

      {loading ? (
        <div className="map-skeleton" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No targeted territories yet"
          text="Launch a campaign and its location will appear on this map."
        />
      ) : (
        <div className="territory-layout">
          <div className="map-card">
            <MapContainer
              center={[40.7128, -74.006]}
              zoom={4}
              scrollWheelZoom
              className="leaflet-map"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <Fit items={items} />

              {items.map((x) => (
                <Circle
                  key={x.id}
                  center={[x.lat, x.lng]}
                  radius={Math.max(1, x.radiusKm) * 1000}
                  pathOptions={{
                    color: "#ff5a66",
                    fillColor: "#ff5a66",
                    fillOpacity: 0.22,
                    weight: 2,
                  }}
                >
                  <Tooltip permanent direction="center">
                    {x.niche}
                  </Tooltip>

                  <Popup>
                    <div className="map-popup">
                      <b>{x.niche}</b>
                      <span>{x.location}</span>
                      <small>{x.leadCount || 0} leads · {x.status}</small>
                    </div>
                  </Popup>
                </Circle>
              ))}
            </MapContainer>
          </div>

          <aside className="territory-list">
            <h3>Targeted markets</h3>

            {items.map((x) => (
              <div key={x.id}>
                <span>
                  <MapPinned />
                </span>

                <div>
                  <b>{x.niche}</b>
                  <small>
                    {x.location} · {x.radiusKm} km
                  </small>
                </div>

                <em>{x.leadCount || 0}</em>
              </div>
            ))}
          </aside>
        </div>
      )}
    </div>
  );
}