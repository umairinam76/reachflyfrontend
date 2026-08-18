import {
  Circle,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  api,
} from "../api";

import {
  CheckCircle2,
  ChevronRight,
  Globe2,
  MapPin,
  MapPinned,
  RefreshCw,
  Search,
  Target,
  X,
} from "../components/icons";

import EmptyState from "../components/EmptyState";

function Fit({
  items,
  selected,
}) {
  const map =
    useMap();

  useEffect(
    () => {
      if (
        selected &&
        Number.isFinite(
          Number(
            selected.lat
          )
        ) &&
        Number.isFinite(
          Number(
            selected.lng
          )
        )
      ) {
        map.flyTo(
          [
            Number(
              selected.lat
            ),
            Number(
              selected.lng
            ),
          ],
          Math.min(
            11,
            Math.max(
              6,
              map.getZoom()
            )
          ),
          {
            duration:
              0.6,
          }
        );

        return;
      }

      const valid =
        items.filter(
          (
            item
          ) =>
            Number.isFinite(
              Number(
                item.lat
              )
            ) &&
            Number.isFinite(
              Number(
                item.lng
              )
            )
        );

      if (
        !valid.length
      ) {
        return;
      }

      const bounds =
        valid.map(
          (
            item
          ) => [
            Number(
              item.lat
            ),
            Number(
              item.lng
            ),
          ]
        );

      map.fitBounds(
        bounds,
        {
          padding: [
            60,
            60,
          ],
          maxZoom:
            11,
        }
      );
    },
    [
      items,
      map,
      selected,
    ]
  );

  return null;
}

export default function Territories() {
  const [
    items,
    setItems,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState("all");

  const [
    selectedId,
    setSelectedId,
  ] = useState("");

  const load =
    useCallback(
      async ({
        silent = false,
        announce = false,
      } = {}) => {
        if (
          silent
        ) {
          setRefreshing(
            true
          );
        } else {
          setLoading(
            true
          );
        }

        setError("");

        try {
          const response =
            await api.territories();

          const next =
            Array.isArray(
              response
            )
              ? response
              : Array.isArray(
                    response?.territories
                  )
                ? response.territories
                : [];

          setItems(
            next
          );

          setSelectedId(
            (
              current
            ) =>
              next.some(
                (
                  item
                ) =>
                  String(
                    item.id
                  ) ===
                  String(
                    current
                  )
              )
                ? current
                : ""
          );

          if (
            announce
          ) {
            notify(
              "success",
              "Territories refreshed",
              "Your latest completed campaign territories are now visible."
            );
          }
        } catch (
          requestError
        ) {
          const message =
            safeMessage(
              requestError?.message ||
                "Territory data could not be loaded."
            );

          setError(
            message
          );

          if (
            announce
          ) {
            notify(
              "error",
              "Territory refresh failed",
              message
            );
          }
        } finally {
          setLoading(
            false
          );
          setRefreshing(
            false
          );
        }
      },
      []
    );

  useEffect(
    () => {
      void load();
    },
    [
      load,
    ]
  );

  const statuses =
    useMemo(
      () => [
        "all",
        ...Array.from(
          new Set(
            items
              .map(
                (
                  item
                ) =>
                  normalizeStatus(
                    item.status
                  )
              )
              .filter(
                Boolean
              )
          )
        ),
      ],
      [
        items,
      ]
    );

  const filteredItems =
    useMemo(
      () => {
        const needle =
          query
            .trim()
            .toLowerCase();

        return items.filter(
          (
            item
          ) => {
            const statusMatches =
              status ===
                "all" ||
              normalizeStatus(
                item.status
              ) ===
                status;

            if (
              !statusMatches
            ) {
              return false;
            }

            if (
              !needle
            ) {
              return true;
            }

            return [
              item.niche,
              item.location,
              item.status,
            ]
              .filter(
                Boolean
              )
              .join(" ")
              .toLowerCase()
              .includes(
                needle
              );
          }
        );
      },
      [
        items,
        query,
        status,
      ]
    );

  const selected =
    useMemo(
      () =>
        filteredItems.find(
          (
            item
          ) =>
            String(
              item.id
            ) ===
            String(
              selectedId
            )
        ) ||
        items.find(
          (
            item
          ) =>
            String(
              item.id
            ) ===
            String(
              selectedId
            )
        ) ||
        null,
      [
        filteredItems,
        items,
        selectedId,
      ]
    );

  const summary =
    useMemo(
      () => {
        const totalLeads =
          items.reduce(
            (
              sum,
              item
            ) =>
              sum +
              (
                Number(
                  item.leadCount
                ) ||
                0
              ),
            0
          );

        const totalRadius =
          items.reduce(
            (
              sum,
              item
            ) =>
              sum +
              (
                Number(
                  item.radiusKm
                ) ||
                0
              ),
            0
          );

        return {
          territories:
            items.length,
          leads:
            totalLeads,
          averageRadius:
            items.length
              ? Math.round(
                  (
                    totalRadius /
                    items.length
                  ) *
                    10
                ) /
                10
              : 0,
        };
      },
      [
        items,
      ]
    );

  return (
    <>
      <TerritoryStyles />

      <main className="rf-territories-v7">
        <header className="rft-page-header">
          <div>
            <span className="rft-eyebrow">
              Territory intelligence
            </span>

            <h1>
              Your targeted-market map.
            </h1>

            <p>
              Review the locations and niches represented by completed campaign
              territories, then open the related campaign when you need the
              underlying lead workflow.
            </p>
          </div>

          <div className="rft-header-actions">
            <Link
              className="rft-button secondary"
              to="/app/builder"
            >
              <Target size={14} />
              Target a new market
            </Link>

            <button
              type="button"
              className="rft-button primary"
              disabled={
                refreshing
              }
              onClick={() =>
                void load({
                  silent:
                    true,
                  announce:
                    true,
                })
              }
            >
              <RefreshCw
                size={14}
                className={
                  refreshing
                    ? "rft-spin"
                    : ""
                }
              />

              {refreshing
                ? "Refreshing…"
                : "Refresh"}
            </button>
          </div>
        </header>

        {error ? (
          <section
            className="rft-alert"
            role="alert"
          >
            <span>
              <X size={13} />
            </span>

            <div>
              <strong>
                Territory data needs attention
              </strong>

              <p>
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setError(
                  ""
                )
              }
              aria-label="Dismiss territory error"
            >
              <X size={10} />
            </button>
          </section>
        ) : null}

        <section className="rft-metrics">
          <Metric
            icon={
              <MapPinned size={16} />
            }
            label="Targeted territories"
            value={
              summary.territories
            }
            text="Completed or historical campaign markets."
          />

          <Metric
            icon={
              <Target size={16} />
            }
            label="Leads represented"
            value={
              summary.leads
            }
            text="Total lead count returned with territory records."
          />

          <Metric
            icon={
              <Globe2 size={16} />
            }
            label="Average radius"
            value={`${summary.averageRadius} km`}
            text="Average campaign search radius across mapped markets."
          />
        </section>

        <section className="rft-toolbar">
          <div className="rft-search">
            <Search size={14} />

            <input
              value={
                query
              }
              onChange={(
                event
              ) =>
                setQuery(
                  event.target
                    .value
                )
              }
              placeholder="Search niche or location…"
            />

            {query ? (
              <button
                type="button"
                onClick={() =>
                  setQuery(
                    ""
                  )
                }
                aria-label="Clear territory search"
              >
                <X size={11} />
              </button>
            ) : null}
          </div>

          <select
            value={
              status
            }
            onChange={(
              event
            ) =>
              setStatus(
                event.target
                  .value
              )
            }
          >
            {statuses.map(
              (
                item
              ) => (
                <option
                  key={
                    item
                  }
                  value={
                    item
                  }
                >
                  {item ===
                  "all"
                    ? "All statuses"
                    : formatStatus(
                        item
                      )}
                </option>
              )
            )}
          </select>

          <span className="rft-result-count">
            {filteredItems.length}{" "}
            {filteredItems.length ===
            1
              ? "territory"
              : "territories"}
          </span>
        </section>

        {loading ? (
          <TerritorySkeleton />
        ) : items.length ===
          0 ? (
          <div className="rft-empty-wrap">
            <EmptyState
              title="No targeted territories yet"
              text="Launch and complete a campaign and its location will appear on this map."
            />

            <Link
              className="rft-button primary"
              to="/app/builder"
            >
              Target your first market
              <ChevronRight size={12} />
            </Link>
          </div>
        ) : (
          <section className="rft-layout">
            <div className="rft-map-card">
              <header>
                <div>
                  <span>
                    <MapPinned size={14} />
                  </span>

                  <div>
                    <small>
                      Market coverage
                    </small>

                    <strong>
                      Completed campaign territories
                    </strong>
                  </div>
                </div>

                <span>
                  <i />
                  Targeted territory
                </span>
              </header>

              <MapContainer
                center={[
                  40.7128,
                  -74.006,
                ]}
                zoom={
                  4
                }
                scrollWheelZoom
                className="rft-leaflet-map"
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <Fit
                  items={
                    filteredItems
                  }
                  selected={
                    selected
                  }
                />

                {filteredItems.map(
                  (
                    item
                  ) => {
                    const lat =
                      Number(
                        item.lat
                      );

                    const lng =
                      Number(
                        item.lng
                      );

                    if (
                      !Number.isFinite(
                        lat
                      ) ||
                      !Number.isFinite(
                        lng
                      )
                    ) {
                      return null;
                    }

                    const active =
                      String(
                        selectedId
                      ) ===
                      String(
                        item.id
                      );

                    return (
                      <Circle
                        key={
                          item.id
                        }
                        center={[
                          lat,
                          lng,
                        ]}
                        radius={
                          Math.max(
                            1,
                            Number(
                              item.radiusKm
                            ) ||
                              10
                          ) *
                          1000
                        }
                        pathOptions={{
                          color:
                            active
                              ? "#3537bb"
                              : "#4648d4",
                          fillColor:
                            "#4648d4",
                          fillOpacity:
                            active
                              ? 0.3
                              : 0.16,
                          weight:
                            active
                              ? 3
                              : 2,
                        }}
                        eventHandlers={{
                          click:
                            () =>
                              setSelectedId(
                                String(
                                  item.id
                                )
                              ),
                        }}
                      >
                        <Tooltip
                          permanent={
                            active
                          }
                          direction="center"
                        >
                          {item.niche ||
                            item.location ||
                            "Territory"}
                        </Tooltip>

                        <Popup>
                          <div className="rft-map-popup">
                            <b>
                              {item.niche ||
                                "Target market"}
                            </b>

                            <span>
                              {item.location ||
                                "Location unavailable"}
                            </span>

                            <small>
                              {Number(
                                item.leadCount
                              ) ||
                                0}{" "}
                              leads ·{" "}
                              {formatStatus(
                                item.status
                              )}
                            </small>
                          </div>
                        </Popup>
                      </Circle>
                    );
                  }
                )}
              </MapContainer>
            </div>

            <aside className="rft-side">
              {selected ? (
                <SelectedTerritory
                  item={
                    selected
                  }
                  onClear={() =>
                    setSelectedId(
                      ""
                    )
                  }
                />
              ) : null}

              <section className="rft-list-card">
                <header>
                  <div>
                    <small>
                      Targeted markets
                    </small>

                    <strong>
                      Territory list
                    </strong>
                  </div>

                  <span>
                    {filteredItems.length}
                  </span>
                </header>

                <div className="rft-list">
                  {filteredItems.length ? (
                    filteredItems.map(
                      (
                        item
                      ) => (
                        <button
                          type="button"
                          key={
                            item.id
                          }
                          className={
                            String(
                              selectedId
                            ) ===
                            String(
                              item.id
                            )
                              ? "active"
                              : ""
                          }
                          onClick={() =>
                            setSelectedId(
                              String(
                                item.id
                              )
                            )
                          }
                        >
                          <span>
                            <MapPin size={14} />
                          </span>

                          <div>
                            <strong>
                              {item.niche ||
                                "Target market"}
                            </strong>

                            <small>
                              {item.location ||
                                "Location unavailable"}{" "}
                              ·{" "}
                              {Number(
                                item.radiusKm
                              ) ||
                                0}{" "}
                              km
                            </small>
                          </div>

                          <em>
                            {Number(
                              item.leadCount
                            ) ||
                              0}
                          </em>
                        </button>
                      )
                    )
                  ) : (
                    <div className="rft-list-empty">
                      No territories match the current filters.
                    </div>
                  )}
                </div>
              </section>
            </aside>
          </section>
        )}
      </main>
    </>
  );
}

function Metric({
  icon,
  label,
  value,
  text,
}) {
  return (
    <article className="rft-metric-card">
      <span>
        {icon}
      </span>

      <div>
        <strong>
          {value}
        </strong>

        <b>
          {label}
        </b>

        <small>
          {text}
        </small>
      </div>
    </article>
  );
}

function SelectedTerritory({
  item,
  onClear,
}) {
  return (
    <section className="rft-selected-card">
      <header>
        <span>
          <MapPinned size={16} />
        </span>

        <div>
          <small>
            Selected territory
          </small>

          <strong>
            {item.niche ||
              "Target market"}
          </strong>
        </div>

        <button
          type="button"
          onClick={
            onClear
          }
          aria-label="Clear selected territory"
        >
          <X size={10} />
        </button>
      </header>

      <div className="rft-selected-details">
        <InfoRow
          label="Location"
          value={
            item.location ||
            "—"
          }
        />

        <InfoRow
          label="Radius"
          value={`${Number(
            item.radiusKm
          ) ||
            0} km`}
        />

        <InfoRow
          label="Lead count"
          value={
            Number(
              item.leadCount
            ) ||
            0
          }
        />

        <InfoRow
          label="Status"
          value={
            formatStatus(
              item.status
            )
          }
        />
      </div>

      {item.id ? (
        <Link
          className="rft-selected-link"
          to={`/app/campaigns/${encodeURIComponent(
            item.id
          )}`}
        >
          Open related campaign
          <ChevronRight size={12} />
        </Link>
      ) : null}
    </section>
  );
}

function InfoRow({
  label,
  value,
}) {
  return (
    <div>
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function TerritorySkeleton() {
  return (
    <section className="rft-skeleton">
      <div>
        <i />
      </div>

      <aside>
        <i />
        <i />
        <i />
      </aside>
    </section>
  );
}

function normalizeStatus(
  value
) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[\s-]+/g,
      "_"
    );
}

function formatStatus(
  value
) {
  const status =
    normalizeStatus(
      value
    );

  if (!status) {
    return "Unknown";
  }

  return status
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    );
}

function safeMessage(
  value
) {
  return String(
    value ||
      ""
  )
    .replace(
      /ElevenLabs/gi,
      "voice service"
    )
    .replace(
      /Telnyx/gi,
      "calling service"
    )
    .replace(
      /\bSIP\b/gi,
      "voice connection"
    );
}

function notify(
  type,
  title,
  message
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  const bridge =
    window.reachflyToast;

  if (
    bridge &&
    typeof bridge[
      type
    ] ===
      "function"
  ) {
    bridge[
      type
    ](
      title,
      message
    );

    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      "reachfly:toast",
      {
        detail: {
          type,
          title,
          message,
        },
      }
    )
  );
}

function TerritoryStyles() {
  return (
    <style>{`
      .rf-territories-v7{
        --rft-card:#fff;
        --rft-soft:#f3f4f5;
        --rft-text:#191c1d;
        --rft-text2:#4d4c59;
        --rft-muted:#777784;
        --rft-line:#e2e4e7;
        --rft-primary:#4648d4;
        --rft-primary-dark:#3739bd;
        --rft-primary-soft:#e8e9ff;
        --rft-red:#ba1a1a;
        --rft-red-soft:#ffedeb;
        --rft-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 44px;
        color:var(--rft-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rftPageIn .24s var(--rft-ease);
      }

      .rf-territories-v7 *,
      .rf-territories-v7 *::before,
      .rf-territories-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rftPageIn{
        from{opacity:0;transform:translateY(5px)}
        to{opacity:1;transform:none}
      }

      @keyframes rftSpin{
        to{transform:rotate(360deg)}
      }

      @keyframes rftShimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      .rft-spin{
        animation:rftSpin .75s linear infinite;
      }

      .rft-page-header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        margin-bottom:17px;
      }

      .rft-eyebrow{
        display:block;
        margin-bottom:4px;
        color:var(--rft-primary);
        font-size:9px;
        font-weight:800;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rft-page-header h1{
        margin:0;
        font:600 32px/40px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rft-page-header p{
        max-width:760px;
        margin:4px 0 0;
        color:var(--rft-text2);
        font-size:12px;
        line-height:18px;
      }

      .rft-header-actions{
        display:flex;
        align-items:center;
        gap:7px;
      }

      .rft-button{
        min-height:39px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 10px;
        border:1px solid transparent;
        border-radius:8px;
        cursor:pointer;
        text-decoration:none;
        font-size:7px;
        font-weight:700;
        transition:.14s var(--rft-ease);
      }

      .rft-button:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rft-button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rft-button.primary{
        color:#fff;
        background:var(--rft-primary);
        border-color:var(--rft-primary);
        box-shadow:0 7px 16px rgba(70,72,212,.14);
      }

      .rft-button.primary:hover:not(:disabled){
        background:var(--rft-primary-dark);
      }

      .rft-button.secondary{
        color:var(--rft-text);
        background:#fff;
        border-color:var(--rft-line);
      }

      .rft-alert{
        display:grid;
        grid-template-columns:27px minmax(0,1fr) 24px;
        align-items:start;
        gap:8px;
        padding:10px 11px;
        margin-bottom:11px;
        color:#7f1b1b;
        background:var(--rft-red-soft);
        border:1px solid #ffd0cc;
        border-radius:9px;
      }

      .rft-alert > span{
        width:27px;
        height:27px;
        display:grid;
        place-items:center;
        background:#fff;
        border-radius:7px;
      }

      .rft-alert strong{
        display:block;
        font-size:7px;
      }

      .rft-alert p{
        margin:1px 0 0;
        font-size:7px;
        line-height:11px;
      }

      .rft-alert > button{
        width:24px;
        height:24px;
        display:grid;
        place-items:center;
        padding:0;
        color:currentColor;
        background:transparent;
        border:0;
        cursor:pointer;
      }

      .rft-metrics{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:9px;
        margin-bottom:11px;
      }

      .rft-metric-card{
        min-height:107px;
        display:grid;
        grid-template-columns:39px minmax(0,1fr);
        align-items:center;
        gap:10px;
        padding:13px;
        background:#fff;
        border:1px solid var(--rft-line);
        border-radius:10px;
      }

      .rft-metric-card > span{
        width:39px;
        height:39px;
        display:grid;
        place-items:center;
        color:var(--rft-primary);
        background:var(--rft-primary-soft);
        border-radius:9px;
      }

      .rft-metric-card > div{
        min-width:0;
        display:grid;
      }

      .rft-metric-card strong{
        font:600 19px/24px Geist,Inter,sans-serif;
      }

      .rft-metric-card b{
        margin-top:1px;
        font-size:6.5px;
      }

      .rft-metric-card small{
        margin-top:2px;
        color:var(--rft-muted);
        font-size:5.5px;
        line-height:9px;
      }

      .rft-toolbar{
        min-height:57px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:9px;
        margin-bottom:11px;
        background:#fff;
        border:1px solid var(--rft-line);
        border-radius:10px;
      }

      .rft-search{
        min-height:37px;
        display:flex;
        align-items:center;
        gap:7px;
        flex:1;
        padding:0 9px;
        color:#8b8c95;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
      }

      .rft-search:focus-within{
        background:#fff;
        border-color:rgba(70,72,212,.45);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rft-search input{
        min-width:0;
        width:100%;
        height:35px;
        padding:0;
        color:var(--rft-text);
        background:transparent;
        border:0;
        outline:0;
        font-size:7px;
      }

      .rft-search button{
        width:25px;
        height:25px;
        display:grid;
        place-items:center;
        padding:0;
        color:#81828a;
        background:#eceeef;
        border:0;
        border-radius:6px;
        cursor:pointer;
      }

      .rft-toolbar select{
        min-height:37px;
        min-width:150px;
        padding:0 9px;
        color:var(--rft-text2);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        outline:0;
        font-size:7px;
      }

      .rft-result-count{
        min-width:90px;
        color:var(--rft-muted);
        text-align:right;
        font-size:6px;
      }

      .rft-layout{
        display:grid;
        grid-template-columns:minmax(0,1fr) 315px;
        align-items:start;
        gap:12px;
      }

      .rft-map-card,
      .rft-list-card,
      .rft-selected-card{
        overflow:hidden;
        background:#fff;
        border:1px solid var(--rft-line);
        border-radius:12px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rft-map-card > header{
        min-height:62px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:10px 12px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rft-line);
      }

      .rft-map-card > header > div{
        display:flex;
        align-items:center;
        gap:8px;
      }

      .rft-map-card > header > div > span{
        width:33px;
        height:33px;
        display:grid;
        place-items:center;
        color:var(--rft-primary);
        background:var(--rft-primary-soft);
        border-radius:8px;
      }

      .rft-map-card > header > div > div{
        display:grid;
      }

      .rft-map-card > header small{
        color:var(--rft-muted);
        font-size:5.5px;
        text-transform:uppercase;
      }

      .rft-map-card > header strong{
        font-size:7px;
      }

      .rft-map-card > header > span{
        display:flex;
        align-items:center;
        gap:5px;
        color:var(--rft-muted);
        font-size:5.5px;
      }

      .rft-map-card > header > span i{
        width:8px;
        height:8px;
        background:var(--rft-primary);
        border-radius:50%;
      }

      .rft-leaflet-map{
        height:600px;
        width:100%;
      }

      .rf-territories-v7 .leaflet-container{
        font-family:Inter,system-ui,sans-serif;
      }

      .rf-territories-v7 .leaflet-tooltip{
        color:#3739bd;
        background:#fff;
        border:1px solid #d9daff;
        border-radius:6px;
        box-shadow:0 4px 10px rgba(25,28,29,.08);
        font-size:6px;
        font-weight:750;
      }

      .rft-map-popup{
        display:grid;
        min-width:155px;
      }

      .rft-map-popup b{
        font-size:8px;
      }

      .rft-map-popup span{
        margin-top:2px;
        color:#555662;
        font-size:6.5px;
      }

      .rft-map-popup small{
        margin-top:5px;
        color:#7f8089;
        font-size:5.5px;
      }

      .rft-side{
        position:sticky;
        top:78px;
        display:grid;
        gap:10px;
      }

      .rft-selected-card > header{
        min-height:64px;
        display:grid;
        grid-template-columns:34px minmax(0,1fr) 24px;
        align-items:center;
        gap:8px;
        padding:10px 11px;
        background:linear-gradient(135deg,#f6f6ff,#fbfbff);
        border-bottom:1px solid #e1e2ff;
      }

      .rft-selected-card > header > span{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        color:var(--rft-primary);
        background:#fff;
        border-radius:8px;
      }

      .rft-selected-card > header > div{
        min-width:0;
        display:grid;
      }

      .rft-selected-card > header small{
        color:var(--rft-primary);
        font-size:5.5px;
        text-transform:uppercase;
      }

      .rft-selected-card > header strong{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:7px;
      }

      .rft-selected-card > header button{
        width:24px;
        height:24px;
        display:grid;
        place-items:center;
        padding:0;
        color:#7d7e87;
        background:#fff;
        border:1px solid #e3e4e6;
        border-radius:6px;
        cursor:pointer;
      }

      .rft-selected-details{
        display:grid;
        padding:7px 11px;
      }

      .rft-selected-details > div{
        min-height:34px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }

      .rft-selected-details > div + div{
        border-top:1px solid #eff0f1;
      }

      .rft-selected-details span{
        color:var(--rft-muted);
        font-size:5.8px;
      }

      .rft-selected-details strong{
        max-width:65%;
        overflow:hidden;
        text-align:right;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6.5px;
      }

      .rft-selected-link{
        min-height:39px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:6px;
        padding:8px 11px;
        color:var(--rft-primary)!important;
        background:#f7f7fc;
        border-top:1px solid var(--rft-line);
        text-decoration:none;
        font-size:6.5px;
        font-weight:750;
      }

      .rft-list-card > header{
        min-height:54px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:9px;
        padding:10px 11px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rft-line);
      }

      .rft-list-card > header > div{
        display:grid;
      }

      .rft-list-card > header small{
        color:var(--rft-muted);
        font-size:5.5px;
        text-transform:uppercase;
      }

      .rft-list-card > header strong{
        font-size:7.5px;
      }

      .rft-list-card > header > span{
        min-width:25px;
        padding:4px 6px;
        color:var(--rft-primary);
        background:var(--rft-primary-soft);
        border-radius:999px;
        text-align:center;
        font-size:5.5px;
        font-weight:750;
      }

      .rft-list{
        max-height:475px;
        overflow:auto;
        display:grid;
        padding:6px;
      }

      .rft-list > button{
        min-height:64px;
        display:grid;
        grid-template-columns:33px minmax(0,1fr) auto;
        align-items:center;
        gap:8px;
        width:100%;
        padding:8px;
        color:inherit;
        background:transparent;
        border:1px solid transparent;
        border-radius:8px;
        text-align:left;
        cursor:pointer;
        transition:.13s var(--rft-ease);
      }

      .rft-list > button:hover{
        background:#f5f6f7;
      }

      .rft-list > button.active{
        background:#f1f1ff;
        border-color:#dddfff;
      }

      .rft-list > button > span{
        width:33px;
        height:33px;
        display:grid;
        place-items:center;
        color:var(--rft-primary);
        background:var(--rft-primary-soft);
        border-radius:8px;
      }

      .rft-list > button > div{
        min-width:0;
      }

      .rft-list > button strong{
        display:block;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6.5px;
      }

      .rft-list > button small{
        display:block;
        margin-top:2px;
        overflow:hidden;
        color:var(--rft-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:5.5px;
      }

      .rft-list > button em{
        min-width:26px;
        padding:4px 6px;
        color:var(--rft-primary);
        background:#fff;
        border:1px solid #e1e2ff;
        border-radius:999px;
        text-align:center;
        font-size:5.5px;
        font-style:normal;
        font-weight:750;
      }

      .rft-list-empty{
        padding:22px 12px;
        color:var(--rft-muted);
        text-align:center;
        font-size:6px;
      }

      .rft-empty-wrap{
        min-height:430px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:12px;
        background:#fff;
        border:1px solid var(--rft-line);
        border-radius:12px;
      }

      .rft-skeleton{
        display:grid;
        grid-template-columns:minmax(0,1fr) 315px;
        gap:12px;
      }

      .rft-skeleton > div,
      .rft-skeleton > aside{
        display:grid;
        gap:9px;
      }

      .rft-skeleton i{
        display:block;
        background:linear-gradient(90deg,#e8eaec 25%,#f8f9fa 45%,#e8eaec 65%);
        background-size:220% 100%;
        border-radius:11px;
        animation:rftShimmer 1.2s linear infinite;
      }

      .rft-skeleton > div i{
        height:660px;
      }

      .rft-skeleton > aside i{
        height:150px;
      }

      .rft-skeleton > aside i:last-child{
        height:330px;
      }

      @media(max-width:1060px){
        .rf-territories-v7{
          padding:22px;
        }

        .rft-layout,
        .rft-skeleton{
          grid-template-columns:minmax(0,1fr) 280px;
        }
      }

      @media(max-width:880px){
        .rft-page-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rft-layout,
        .rft-skeleton{
          grid-template-columns:1fr;
        }

        .rft-side{
          position:static;
          grid-template-columns:1fr 1fr;
        }

        .rft-list{
          max-height:360px;
        }
      }

      @media(max-width:640px){
        .rf-territories-v7{
          padding:18px 12px 80px;
        }

        .rft-page-header h1{
          font-size:25px;
          line-height:32px;
        }

        .rft-page-header p{
          font-size:10px;
          line-height:16px;
        }

        .rft-header-actions{
          display:grid;
          grid-template-columns:1fr 1fr;
          width:100%;
        }

        .rft-metrics{
          grid-template-columns:1fr;
        }

        .rft-toolbar{
          align-items:stretch;
          flex-direction:column;
        }

        .rft-toolbar select{
          width:100%;
        }

        .rft-result-count{
          min-width:0;
          text-align:left;
        }

        .rft-map-card > header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rft-leaflet-map{
          height:470px;
        }

        .rft-side{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:420px){
        .rft-header-actions{
          grid-template-columns:1fr;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-territories-v7,
        .rft-spin,
        .rft-skeleton i{
          animation:none!important;
        }

        .rf-territories-v7 *,
        .rf-territories-v7 *::before,
        .rf-territories-v7 *::after{
          transition-duration:.01ms!important;
        }
      }
    `}</style>
  );
}
