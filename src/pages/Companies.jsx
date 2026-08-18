import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Star,
  Target,
  TrendingUp,
  Users,
  X,
} from "../components/icons";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";

/**
 * ReachFly.AI V7 Companies
 *
 * The current backend exposes campaign/contact records, not a standalone
 * company CRUD API. This page therefore derives B2B accounts from real
 * api.contacts() data by grouping contacts by company domain/name.
 *
 * No company persistence is faked. "Add Company" routes into the existing
 * lead import flow so the resulting contact/company data remains real.
 */

const PAGE_SIZE = 12;
const IDLE_DAYS = 14;
const STAGE_PRIORITY = {
  new: 10,
  queued: 15,
  contacted: 20,
  discovery: 25,
  replied: 30,
  interested: 35,
  qualified: 40,
  proposal: 50,
  negotiation: 60,
  meeting_booked: 65,
  closed_won: 90,
  won: 90,
  customer: 95,
  closed_lost: -10,
  lost: -10,
  not_interested: -20,
};

export default function Companies() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("search") || "");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [sortBy, setSortBy] = useState("activity");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [activeCompany, setActiveCompany] = useState(null);
  const [page, setPage] = useState(1);

  const role = normalizeWorkspaceRole(user?.workspaceRole || user?.role || "");
  const canViewCompanies = ["owner", "admin", "manager"].includes(role);

  const load = useCallback(
    async ({ silent = false, successToast = false } = {}) => {
      if (!canViewCompanies) {
        setContacts([]);
        setLoading(false);
        return;
      }

      silent ? setRefreshing(true) : setLoading(true);

      try {
        const response = await api.contacts();
        setContacts(normalizeContactsResponse(response));
        setError("");
        if (successToast) {
          notify("success", "Companies refreshed", "Your latest CRM account activity is now visible.");
        }
      } catch (requestError) {
        const message = requestError?.message || "Company records could not be loaded.";
        setError(message);
        if (!silent) setContacts([]);
        if (successToast) notify("error", "Company refresh failed", message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canViewCompanies]
  );

  useEffect(() => {
    if (!user) return undefined;
    if (!canViewCompanies) {
      navigate("/app/dashboard", { replace: true });
      return undefined;
    }

    void load();
    const timer = window.setInterval(() => void load({ silent: true }), 60_000);
    return () => window.clearInterval(timer);
  }, [canViewCompanies, load, navigate, user]);

  useEffect(() => {
    const search = new URLSearchParams(location.search).get("search");
    if (search !== null && search !== query) setQuery(search);
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(1);
  }, [attentionOnly, industryFilter, ownerFilter, query, sortBy, stageFilter]);

  const normalizedContacts = useMemo(
    () => contacts.map((item, index) => normalizeContact(item, index)),
    [contacts]
  );

  const companies = useMemo(() => groupCompanies(normalizedContacts), [normalizedContacts]);
  const industries = useMemo(
    () => uniqueSorted(companies.map((item) => item.industry).filter((value) => value && value !== "Uncategorized")),
    [companies]
  );
  const stages = useMemo(() => uniqueSorted(companies.map((item) => item.stage).filter(Boolean)), [companies]);
  const owners = useMemo(
    () => uniqueSorted(companies.map((item) => item.owner).filter((value) => value && value !== "Unassigned")),
    [companies]
  );

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const result = companies.filter((company) => {
      if (industryFilter !== "all" && company.industry !== industryFilter) return false;
      if (stageFilter !== "all" && normalizeStatus(company.stage) !== normalizeStatus(stageFilter)) return false;
      if (ownerFilter !== "all" && company.owner !== ownerFilter) return false;
      if (attentionOnly && !company.needsAttention) return false;
      if (!search) return true;

      const searchable = [
        company.name,
        company.domain,
        company.industry,
        company.location,
        company.stage,
        company.owner,
        company.lastActivityLabel,
        ...company.campaignNames,
        ...company.contacts.flatMap((contact) => [contact.name, contact.email, contact.phone, contact.campaignName]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(search);
    });

    return result.sort((left, right) => {
      if (sortBy === "name") return left.name.localeCompare(right.name);
      if (sortBy === "contacts") return right.contacts.length - left.contacts.length;
      if (sortBy === "stage") return getStagePriority(right.stage) - getStagePriority(left.stage);
      if (sortBy === "score") return compareNullableNumbersDesc(left.score, right.score);
      return right.lastActivityAtMs - left.lastActivityAtMs;
    });
  }, [attentionOnly, companies, industryFilter, ownerFilter, query, sortBy, stageFilter]);

  const metrics = useMemo(() => buildCompanyMetrics(companies), [companies]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageCompanies = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );
  const visibleKeys = useMemo(() => pageCompanies.map((item) => item.key), [pageCompanies]);
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedKeys.has(key));
  const selectedCompanies = useMemo(
    () => companies.filter((item) => selectedKeys.has(item.key)),
    [companies, selectedKeys]
  );

  const rangeStart = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = filtered.length ? Math.min(safePage * PAGE_SIZE, filtered.length) : 0;
  const hasFilters =
    industryFilter !== "all" ||
    stageFilter !== "all" ||
    ownerFilter !== "all" ||
    attentionOnly ||
    sortBy !== "activity";

  function toggleVisibleSelection() {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleKeys.forEach((key) => next.delete(key));
      else visibleKeys.forEach((key) => next.add(key));
      return next;
    });
  }

  function toggleCompanySelection(key) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function resetFilters() {
    setIndustryFilter("all");
    setStageFilter("all");
    setOwnerFilter("all");
    setAttentionOnly(false);
    setSortBy("activity");
    setFiltersOpen(false);
  }

  function exportCompanies(list, suffix = "companies") {
    if (!list.length) {
      notify("warning", "Nothing to export", "No companies are available in the current view.");
      return;
    }

    const rows = list.map((company) => ({
      Company: company.name,
      Domain: company.domain,
      Website: company.website,
      Industry: company.industry,
      Location: company.location,
      Contacts: company.contacts.length,
      Stage: titleCase(company.stage),
      Owner: company.owner,
      "Lead Score": company.score ?? "",
      "Last Activity": company.lastActivityAt ? new Date(company.lastActivityAt).toISOString() : "",
      "Last Activity Type": company.lastActivityLabel,
      Campaigns: company.campaignNames.join(" | "),
    }));

    downloadCsv(rows, `reachfly-${suffix}-${formatFileDate(new Date())}.csv`);
    notify(
      "success",
      "Companies exported",
      `${formatNumber(list.length)} compan${list.length === 1 ? "y" : "ies"} exported as CSV.`
    );
  }

  if (!canViewCompanies) {
    return (
      <>
        <CompaniesStyles />
        <div className="rf-companies-v7">
          <section className="rfco-access">
            <span className="rfco-access-icon"><Building2 size={24} /></span>
            <span className="rfco-eyebrow">Restricted workspace feature</span>
            <h1>Company access required</h1>
            <p>Shared CRM company accounts are available to workspace owners, administrators, and managers.</p>
            <button type="button" className="rfco-btn rfco-btn-primary" onClick={() => navigate("/app/dashboard", { replace: true })}>
              Return to dashboard <ArrowRight size={15} />
            </button>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <CompaniesStyles />
      <div className="rf-companies-v7">
        <header className="rfco-header">
          <div>
            <span className="rfco-eyebrow">CRM</span>
            <h1>Companies</h1>
            <p>Manage and track your B2B accounts.</p>
          </div>

          <div className="rfco-header-actions">
            <div className="rfco-filter-anchor">
              <button
                type="button"
                className={`rfco-btn rfco-btn-secondary ${hasFilters ? "active" : ""}`}
                aria-haspopup="dialog"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((value) => !value)}
              >
                <Target size={15} /> Filter
                {hasFilters ? (
                  <span className="rfco-filter-count">
                    {[
                      industryFilter !== "all",
                      stageFilter !== "all",
                      ownerFilter !== "all",
                      attentionOnly,
                      sortBy !== "activity",
                    ].filter(Boolean).length}
                  </span>
                ) : null}
                <ChevronDown size={13} />
              </button>

              {filtersOpen ? (
                <CompanyFilters
                  industryFilter={industryFilter}
                  onIndustryFilter={setIndustryFilter}
                  stageFilter={stageFilter}
                  onStageFilter={setStageFilter}
                  ownerFilter={ownerFilter}
                  onOwnerFilter={setOwnerFilter}
                  attentionOnly={attentionOnly}
                  onAttentionOnly={setAttentionOnly}
                  sortBy={sortBy}
                  onSortBy={setSortBy}
                  industries={industries}
                  stages={stages}
                  owners={owners}
                  onReset={resetFilters}
                  onClose={() => setFiltersOpen(false)}
                />
              ) : null}
            </div>

            <button
              type="button"
              className="rfco-btn rfco-btn-secondary"
              disabled={filtered.length === 0}
              onClick={() => exportCompanies(filtered)}
            >
              <Send size={15} /> Export
            </button>

            <Link className="rfco-btn rfco-btn-primary" to="/app/campaigns/external-leads">
              <Plus size={15} /> Add Company
            </Link>
          </div>
        </header>

        <section className="rfco-metrics">
          <CompanyMetric
            label="Total Accounts"
            value={formatNumber(metrics.total)}
            icon={<Building2 size={17} />}
            tone="primary"
            note="CRM companies"
          />
          <CompanyMetric
            label="Avg Lead Score"
            value={metrics.averageScore !== null ? formatScore(metrics.averageScore) : "—"}
            suffix={metrics.averageScore !== null ? "/ 100" : ""}
            icon={<TrendingUp size={17} />}
            tone="violet"
            note={
              metrics.scoredCompanies > 0
                ? `${formatNumber(metrics.scoredCompanies)} scored accounts`
                : "No explicit lead scores yet"
            }
          />
          <CompanyMetric
            label="Needs Attention"
            value={formatNumber(metrics.needsAttention)}
            icon={<Clock3 size={17} />}
            tone="danger"
            note={`idle > ${IDLE_DAYS} days`}
          />
        </section>

        {selectedCompanies.length > 0 ? (
          <section className="rfco-bulk-bar">
            <div>
              <span><CheckCircle2 size={14} /></span>
              <strong>{formatNumber(selectedCompanies.length)} selected</strong>
              <small>Export or open the associated contacts.</small>
            </div>
            <div>
              <button type="button" onClick={() => exportCompanies(selectedCompanies, "selected-companies")}>
                <Send size={13} /> Export
              </button>
              {selectedCompanies.length === 1 ? (
                <Link to={`/app/contacts?search=${encodeURIComponent(selectedCompanies[0].name)}`}>
                  <Users size={13} /> Contacts
                </Link>
              ) : null}
              <button type="button" onClick={() => setSelectedKeys(new Set())}>
                <X size={13} /> Clear
              </button>
            </div>
          </section>
        ) : null}

        {error ? (
          <section className="rfco-message error" role="alert">
            <span><X size={15} /></span>
            <div><strong>Company data needs attention</strong><small>{error}</small></div>
            <button type="button" onClick={() => void load({ successToast: true })}>Try again</button>
          </section>
        ) : null}

        <section className="rfco-table-card">
          <div className="rfco-table-toolbar">
            <div className="rfco-table-title">
              <span><Building2 size={17} /></span>
              <strong>All Companies</strong>
              <i>{formatNumber(filtered.length)}</i>
            </div>

            <div className="rfco-table-tools">
              <label className="rfco-search">
                <Search size={16} aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search companies..."
                  aria-label="Search companies"
                />
                {query ? (
                  <button type="button" aria-label="Clear company search" onClick={() => setQuery("")}>
                    <X size={13} />
                  </button>
                ) : null}
              </label>
              <button
                type="button"
                className="rfco-refresh"
                title="Refresh companies"
                aria-label="Refresh companies"
                disabled={refreshing}
                onClick={() => void load({ silent: true, successToast: true })}
              >
                <RefreshCw size={15} className={refreshing ? "spin" : ""} />
              </button>
            </div>
          </div>

          {loading ? (
            <CompaniesSkeleton />
          ) : filtered.length === 0 ? (
            <CompaniesEmpty
              hasSearch={Boolean(query.trim())}
              hasFilters={hasFilters}
              onReset={() => {
                setQuery("");
                resetFilters();
              }}
            />
          ) : (
            <>
              <div className="rfco-table-wrap">
                <table className="rfco-table">
                  <thead>
                    <tr>
                      <th className="select">
                        <CompanyCheckbox checked={allVisibleSelected} label="Select visible companies" onChange={toggleVisibleSelection} />
                      </th>
                      <th>Company</th>
                      <th>Industry</th>
                      <th>Location</th>
                      <th>Contacts</th>
                      <th>Stage</th>
                      <th>Owner</th>
                      <th className="score">Score</th>
                      <th className="activity">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageCompanies.map((company, index) => (
                      <CompanyRow
                        key={company.key}
                        company={company}
                        selected={selectedKeys.has(company.key)}
                        onSelected={() => toggleCompanySelection(company.key)}
                        onOpen={() => setActiveCompany(company)}
                        index={index}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rfco-mobile-list">
                {pageCompanies.map((company, index) => (
                  <CompanyMobileCard
                    key={company.key}
                    company={company}
                    selected={selectedKeys.has(company.key)}
                    onSelected={() => toggleCompanySelection(company.key)}
                    onOpen={() => setActiveCompany(company)}
                    index={index}
                  />
                ))}
              </div>

              <footer className="rfco-footer">
                <span>
                  Showing <strong>{rangeStart}</strong> to <strong>{rangeEnd}</strong> of <strong>{formatNumber(filtered.length)}</strong>
                </span>
                <CompanyPagination page={safePage} count={pageCount} onChange={setPage} />
              </footer>
            </>
          )}
        </section>

        {activeCompany ? <CompanyDrawer company={activeCompany} onClose={() => setActiveCompany(null)} /> : null}
      </div>
    </>
  );
}

function CompanyMetric({ label, value, suffix = "", icon, tone, note }) {
  return (
    <article className={`rfco-metric ${tone}`}>
      <span className="rfco-metric-orb" />
      <div className="rfco-metric-label"><span>{icon}</span><strong>{label}</strong></div>
      <div className="rfco-metric-value"><strong>{value}</strong>{suffix ? <span>{suffix}</span> : null}</div>
      <small>{note}</small>
    </article>
  );
}

function CompanyFilters({
  industryFilter,
  onIndustryFilter,
  stageFilter,
  onStageFilter,
  ownerFilter,
  onOwnerFilter,
  attentionOnly,
  onAttentionOnly,
  sortBy,
  onSortBy,
  industries,
  stages,
  owners,
  onReset,
  onClose,
}) {
  return (
    <div className="rfco-filter-popover" role="dialog" aria-label="Company filters">
      <div className="rfco-popover-head">
        <div><strong>Filter companies</strong><span>Refine the account view</span></div>
        <button type="button" aria-label="Close filters" onClick={onClose}><X size={14} /></button>
      </div>

      <FilterSelect label="Industry" value={industryFilter} onChange={onIndustryFilter}>
        <option value="all">All industries</option>
        {industries.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
      </FilterSelect>

      <FilterSelect label="Stage" value={stageFilter} onChange={onStageFilter}>
        <option value="all">All stages</option>
        {stages.map((stage) => <option key={stage} value={stage}>{titleCase(stage)}</option>)}
      </FilterSelect>

      <FilterSelect label="Owner" value={ownerFilter} onChange={onOwnerFilter}>
        <option value="all">All owners</option>
        {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
      </FilterSelect>

      <FilterSelect label="Sort" value={sortBy} onChange={onSortBy}>
        <option value="activity">Latest activity</option>
        <option value="name">Company name</option>
        <option value="score">Highest lead score</option>
        <option value="contacts">Most contacts</option>
        <option value="stage">Most advanced stage</option>
      </FilterSelect>

      <label className="rfco-toggle-row">
        <input type="checkbox" checked={attentionOnly} onChange={(event) => onAttentionOnly(event.target.checked)} />
        <span>
          <strong>Needs attention only</strong>
          <small>Last recorded activity is older than {IDLE_DAYS} days.</small>
        </span>
      </label>

      <div className="rfco-popover-actions">
        <button type="button" className="ghost" onClick={onReset}>Reset</button>
        <button type="button" className="primary" onClick={onClose}>Apply</button>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="rfco-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  );
}

function CompanyRow({ company, selected, onSelected, onOpen, index }) {
  return (
    <tr
      className={`${selected ? "selected" : ""} ${company.needsAttention ? "needs-attention" : ""}`}
      style={{ "--rfco-row-index": index }}
      onClick={onOpen}
    >
      <td className="select" onClick={(event) => event.stopPropagation()}>
        <CompanyCheckbox checked={selected} label={`Select ${company.name}`} onChange={onSelected} />
      </td>
      <td><CompanyIdentity company={company} /></td>
      <td><IndustryPill industry={company.industry} /></td>
      <td><span className="rfco-location"><MapPin size={13} />{company.location || "—"}</span></td>
      <td><CompanyContacts contacts={company.contacts} /></td>
      <td><StagePill stage={company.stage} /></td>
      <td><OwnerCell owner={company.owner} /></td>
      <td className="score"><ScoreCell score={company.score} /></td>
      <td className="activity"><LastActivityCell company={company} /></td>
    </tr>
  );
}

function CompanyMobileCard({ company, selected, onSelected, onOpen, index }) {
  return (
    <article className={`rfco-mobile-card ${selected ? "selected" : ""}`} style={{ "--rfco-row-index": index }}>
      <div className="rfco-mobile-head">
        <CompanyCheckbox checked={selected} label={`Select ${company.name}`} onChange={onSelected} />
        <button type="button" className="rfco-mobile-open" onClick={onOpen}>
          <CompanyIdentity company={company} /><ChevronRight size={16} />
        </button>
      </div>
      <div className="rfco-mobile-meta"><IndustryPill industry={company.industry} /><StagePill stage={company.stage} /></div>
      <div className="rfco-mobile-details">
        <span><MapPin size={12} />{company.location || "Location unavailable"}</span>
        <span><Users size={12} />{formatNumber(company.contacts.length)} contact{company.contacts.length === 1 ? "" : "s"}</span>
        <OwnerCell owner={company.owner} compact />
      </div>
      <div className="rfco-mobile-foot"><ScoreCell score={company.score} compact /><LastActivityCell company={company} compact /></div>
    </article>
  );
}

function CompanyIdentity({ company }) {
  return (
    <div className="rfco-company-identity">
      <span className={`rfco-company-logo ${getAvatarTone(company.name)}`}>{getInitials(company.name)}</span>
      <span><strong>{company.name}</strong><small>{company.domain || "No domain"}</small></span>
    </div>
  );
}

function IndustryPill({ industry }) {
  const value = industry || "Uncategorized";
  return <span className={`rfco-industry ${getIndustryTone(value)}`}>{value}</span>;
}

function CompanyContacts({ contacts }) {
  const preview = contacts.slice(0, 3);
  const extra = Math.max(0, contacts.length - preview.length);
  return (
    <div className="rfco-contact-stack" title={`${contacts.length} contact${contacts.length === 1 ? "" : "s"}`}>
      {preview.map((contact) => (
        <span key={contact.key} className={getAvatarTone(contact.name)}>{getInitials(contact.name)}</span>
      ))}
      {extra > 0 ? <i>+{extra}</i> : null}
    </div>
  );
}

function OwnerCell({ owner, compact = false }) {
  if (!owner || owner === "Unassigned") return <span className="rfco-unassigned">Unassigned</span>;
  return (
    <span className={`rfco-owner ${compact ? "compact" : ""}`}>
      <i>{getInitials(owner)}</i><span>{owner}</span>
    </span>
  );
}

function ScoreCell({ score, compact = false }) {
  if (score === null) return <span className="rfco-score-empty">—</span>;
  const tone = score >= 75 ? "strong" : score >= 50 ? "medium" : "low";
  return (
    <span className={`rfco-score ${tone} ${compact ? "compact" : ""}`}>
      <strong>{Math.round(score)}</strong><i style={{ "--rfco-score": score }} />
    </span>
  );
}

function LastActivityCell({ company, compact = false }) {
  return (
    <span className={`rfco-last-activity ${company.needsAttention ? "attention" : ""} ${compact ? "compact" : ""}`}>
      {!compact ? <strong>{company.lastActivityLabel || "No activity"}</strong> : null}
      <small>{company.lastActivityAt ? formatRelativeOrDate(company.lastActivityAt) : "No activity"}</small>
    </span>
  );
}

function StagePill({ stage }) {
  return <span className={`rfco-stage ${getStageTone(stage)}`}>{titleCase(stage || "new")}</span>;
}

function CompanyCheckbox({ checked, label, onChange }) {
  return (
    <button
      type="button"
      className={`rfco-checkbox ${checked ? "checked" : ""}`}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      {checked ? <CheckCircle2 size={13} /> : null}
    </button>
  );
}

function CompanyDrawer({ company, onClose }) {
  const activities = buildCompanyActivity(company);
  const primaryCampaignId = company.campaignIds[0] || "";
  const mailRecipients = company.contacts.map((contact) => contact.email).filter(Boolean).slice(0, 20);

  return (
    <div
      className="rfco-drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="rfco-drawer" role="dialog" aria-modal="true" aria-label={`Company details for ${company.name}`}>
        <header className="rfco-drawer-top">
          <span className="rfco-eyebrow">Company</span>
          <button type="button" aria-label="Close company details" onClick={onClose}><X size={16} /></button>
        </header>

        <section className="rfco-company-profile">
          <span className={`rfco-profile-logo ${getAvatarTone(company.name)}`}>{getInitials(company.name)}</span>
          <h2>{company.name}</h2>
          <p>{company.domain || company.industry || "ReachFly account"}</p>
          <div className="rfco-profile-chips"><IndustryPill industry={company.industry} /><StagePill stage={company.stage} /></div>
          <div className="rfco-profile-actions">
            {company.website ? (
              <a href={company.website} target="_blank" rel="noreferrer" title="Open company website"><Globe2 size={15} /></a>
            ) : (
              <button type="button" disabled title="No website"><Globe2 size={15} /></button>
            )}
            <Link to={`/app/contacts?search=${encodeURIComponent(company.name)}`} onClick={onClose} title="View company contacts">
              <Users size={15} />
            </Link>
            {mailRecipients.length ? (
              <a href={`mailto:${mailRecipients.join(",")}`} title="Email company contacts"><Mail size={15} /></a>
            ) : (
              <button type="button" disabled title="No contact email"><Mail size={15} /></button>
            )}
          </div>
        </section>

        <section className="rfco-drawer-section">
          <div className="rfco-drawer-section-head"><span>Account Overview</span><ScoreCell score={company.score} compact /></div>
          <dl className="rfco-detail-list">
            <CompanyDetailRow label="Industry" value={company.industry || "Uncategorized"} />
            <CompanyDetailRow label="Location" value={company.location || "—"} />
            <CompanyDetailRow label="Owner" value={company.owner} />
            <CompanyDetailRow label="Contacts" value={formatNumber(company.contacts.length)} />
            <CompanyDetailRow label="Campaigns" value={formatNumber(company.campaignNames.length)} />
            <CompanyDetailRow label="Last activity" value={company.lastActivityAt ? formatRelativeOrDate(company.lastActivityAt) : "No activity"} />
          </dl>
        </section>

        <section className="rfco-drawer-section">
          <div className="rfco-drawer-section-head">
            <span>Contacts</span>
            <Link to={`/app/contacts?search=${encodeURIComponent(company.name)}`} onClick={onClose}>View all</Link>
          </div>
          <div className="rfco-drawer-contacts">
            {company.contacts.slice(0, 6).map((contact) => <DrawerContact key={contact.key} contact={contact} />)}
          </div>
        </section>

        <section className="rfco-drawer-section">
          <div className="rfco-drawer-section-head"><span>Campaigns</span></div>
          {company.campaignNames.length ? (
            <div className="rfco-campaign-list">
              {company.campaignNames.slice(0, 5).map((name) => <span key={name}><Target size={12} />{name}</span>)}
            </div>
          ) : (
            <span className="rfco-muted-copy">No campaign name is attached to this account.</span>
          )}
        </section>

        <section className="rfco-drawer-section grow">
          <div className="rfco-drawer-section-head"><span>Recent Activity</span></div>
          {activities.length ? (
            <div className="rfco-activity-list">
              {activities.map((activity, index) => (
                <CompanyActivity
                  key={`${activity.type}-${activity.at}-${index}`}
                  activity={activity}
                  last={index === activities.length - 1}
                />
              ))}
            </div>
          ) : (
            <div className="rfco-drawer-empty"><Clock3 size={18} /><span>No timestamped company activity is available yet.</span></div>
          )}
        </section>

        <footer className="rfco-drawer-footer">
          <Link className="rfco-btn rfco-btn-secondary" to={`/app/contacts?search=${encodeURIComponent(company.name)}`} onClick={onClose}>
            <Users size={14} /> Contacts
          </Link>
          <Link className="rfco-btn rfco-btn-secondary" to="/app/audits" onClick={onClose}>
            <Star size={14} /> AI Audit
          </Link>
          <Link className="rfco-btn rfco-btn-primary" to={primaryCampaignId ? `/app/campaigns/${primaryCampaignId}` : "/app/campaigns"} onClick={onClose}>
            <Target size={14} /> Campaign
          </Link>
        </footer>
      </aside>
    </div>
  );
}

function DrawerContact({ contact }) {
  return (
    <div className="rfco-drawer-contact">
      <span className={getAvatarTone(contact.name)}>{getInitials(contact.name)}</span>
      <div><strong>{contact.name}</strong><small>{contact.email || contact.phone || titleCase(contact.stage) || "Contact"}</small></div>
      <div>
        {contact.email ? <a href={`mailto:${contact.email}`} title="Email contact"><Mail size={12} /></a> : null}
        {contact.phone ? <a href={`tel:${contact.phone}`} title="Call contact"><Phone size={12} /></a> : null}
      </div>
    </div>
  );
}

function CompanyDetailRow({ label, value }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function CompanyActivity({ activity, last }) {
  const Icon = activity.icon;
  return (
    <div className="rfco-activity-item">
      <div className="rfco-activity-rail"><span className={activity.tone}><Icon size={12} /></span>{!last ? <i /> : null}</div>
      <div><strong>{activity.title}</strong><small>{formatRelativeOrDate(activity.at)}</small>{activity.copy ? <p>{activity.copy}</p> : null}</div>
    </div>
  );
}

function CompaniesSkeleton() {
  return (
    <div className="rfco-skeleton" aria-busy="true" aria-label="Loading companies">
      <div className="rfco-skeleton-head">{Array.from({ length: 8 }).map((_, index) => <i key={index} />)}</div>
      {Array.from({ length: 6 }).map((_, row) => (
        <div className="rfco-skeleton-row" key={row}>
          <i /><i className="identity" /><i /><i /><i /><i /><i /><i />
        </div>
      ))}
    </div>
  );
}

function CompaniesEmpty({ hasSearch, hasFilters, onReset }) {
  return (
    <div className="rfco-empty">
      <span><Building2 size={26} /></span>
      <h2>{hasSearch || hasFilters ? "No matching companies" : "No companies yet"}</h2>
      <p>
        {hasSearch || hasFilters
          ? "Try another search or reset your company filters."
          : "Companies are created from real campaign and contact records. Find or import leads to build the company database."}
      </p>
      <div>
        {hasSearch || hasFilters ? (
          <button type="button" className="rfco-btn rfco-btn-secondary" onClick={onReset}>Reset view</button>
        ) : (
          <>
            <Link className="rfco-btn rfco-btn-secondary" to="/app/leads">Find Leads</Link>
            <Link className="rfco-btn rfco-btn-primary" to="/app/campaigns/external-leads"><Plus size={14} /> Add Company</Link>
          </>
        )}
      </div>
    </div>
  );
}

function CompanyPagination({ page, count, onChange }) {
  if (count <= 1) return null;
  const values = buildPagination(page, count);
  return (
    <nav className="rfco-pagination" aria-label="Company pages">
      <button type="button" aria-label="Previous companies" disabled={page <= 1} onClick={() => onChange(Math.max(1, page - 1))}>‹</button>
      {values.map((value, index) =>
        value === "…" ? (
          <span key={`ellipsis-${index}`}>…</span>
        ) : (
          <button
            type="button"
            key={value}
            className={value === page ? "active" : ""}
            aria-current={value === page ? "page" : undefined}
            onClick={() => onChange(value)}
          >
            {value}
          </button>
        )
      )}
      <button type="button" aria-label="Next companies" disabled={page >= count} onClick={() => onChange(Math.min(count, page + 1))}>›</button>
    </nav>
  );
}

/* ========================================================================== */
/* Data aggregation                                                           */
/* ========================================================================== */

function normalizeContactsResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.contacts)) return response.contacts;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.leads)) return response.leads;
  return [];
}

function normalizeContact(raw = {}, index = 0) {
  const name = firstString(
    raw.contactName,
    raw.fullName,
    raw.personName,
    raw.leadName,
    raw.name,
    raw.business,
    raw.companyName,
    "Unknown contact"
  );

  const companyName = firstString(
    raw.companyName,
    raw.business,
    raw.organization,
    raw.accountName,
    raw.company?.name,
    raw.name,
    "Unknown company"
  );

  const website = firstString(raw.website, raw.websiteUrl, raw.domain, raw.companyWebsite, raw.company?.website);
  const email = firstString(raw.email, raw.contactEmail, raw.workEmail, raw.primaryEmail);
  const phone = firstString(raw.phone, raw.phoneNumber, raw.mobile, raw.contactPhone, raw.primaryPhone);
  const domain = normalizeDomain(website) || getEmailDomain(email);
  const industry = firstString(
    raw.industry,
    raw.niche,
    raw.category,
    raw.businessCategory,
    raw.categoryName,
    raw.company?.industry,
    "Uncategorized"
  );
  const location = firstString(
    raw.location,
    raw.city,
    raw.region,
    raw.area,
    raw.formattedAddress,
    raw.address,
    raw.companyAddress,
    raw.company?.location
  );
  const stage =
    normalizeStatus(
      firstString(
        raw.companyStage,
        raw.accountStage,
        raw.pipelineStage,
        raw.pipelineStatus,
        raw.dealStage,
        raw.stage,
        raw.leadStatus,
        raw.status,
        raw.lastCallOutcome,
        "new"
      )
    ) || "new";
  const owner = firstString(
    raw.ownerName,
    raw.assignedToName,
    raw.assigneeName,
    raw.assignedUserName,
    raw.owner?.name,
    raw.assignee?.name,
    raw.assignedUser?.name,
    "Unassigned"
  );
  const campaignName = firstString(raw.campaignName, raw.campaign?.name, raw.campaignTitle);
  const campaignId = firstString(raw.campaignId, raw.campaign?.id);
  const createdAt = firstDateValue(raw.createdAt, raw.discoveredAt, raw.importedAt, raw.addedAt);
  const latestActivity = getLatestContactActivity(raw, createdAt);
  const explicitScore = finiteNumberOrNull(
    raw.leadScore ?? raw.qualityScore ?? raw.matchScore ?? raw.confidence ?? raw.score
  );

  return {
    key: String(raw.id || raw.contactId || raw.leadId || raw.placeId || raw.externalId || `${companyName}-${name}-${index}`),
    raw,
    name,
    companyName,
    website: normalizeWebsiteUrl(website),
    domain,
    industry,
    location,
    email,
    phone,
    stage,
    owner,
    campaignName,
    campaignId,
    createdAt,
    lastActivityAt: latestActivity.at,
    lastActivityType: latestActivity.type,
    lastActivityLabel: latestActivity.label,
    explicitScore: explicitScore === null ? null : clampScore(explicitScore),
  };
}

function groupCompanies(contacts) {
  const groups = new Map();
  contacts.forEach((contact) => {
    const key = buildCompanyGroupKey(contact);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(contact);
  });
  return Array.from(groups.entries()).map(([key, members]) => buildCompanyRecord(key, members));
}

function buildCompanyGroupKey(contact) {
  if (contact.domain) return `domain:${contact.domain}`;
  const name = normalizeCompanyName(contact.companyName);
  if (name) return `name:${name}`;
  return `contact:${normalizeCompanyName(contact.name) || contact.key}`;
}

function buildCompanyRecord(key, members) {
  const name = mostCommonValue(members.map((item) => item.companyName)) || members[0]?.name || "Unknown company";
  const domain = mostCommonValue(members.map((item) => item.domain).filter(Boolean));
  const website = mostCommonValue(members.map((item) => item.website).filter(Boolean)) || (domain ? `https://${domain}` : "");
  const industry =
    mostCommonValue(members.map((item) => item.industry).filter((value) => value && value !== "Uncategorized")) ||
    "Uncategorized";
  const location = mostCommonValue(members.map((item) => item.location).filter(Boolean));
  const owner =
    mostCommonValue(members.map((item) => item.owner).filter((value) => value && value !== "Unassigned")) ||
    "Unassigned";
  const stage = pickCompanyStage(members.map((item) => item.stage));
  const scored = members.map((item) => item.explicitScore).filter((value) => value !== null);
  const score = scored.length ? scored.reduce((sum, value) => sum + value, 0) / scored.length : null;
  const sortedMembers = [...members].sort(
    (left, right) => getTimestamp(right.lastActivityAt) - getTimestamp(left.lastActivityAt)
  );
  const activityContact = sortedMembers.find((item) => item.lastActivityAt) || null;
  const lastActivityAt = activityContact?.lastActivityAt || "";

  return {
    key,
    name,
    domain,
    website,
    industry,
    location,
    contacts: sortedMembers,
    stage,
    owner,
    score: score === null ? null : Math.round(score * 10) / 10,
    lastActivityAt,
    lastActivityAtMs: getTimestamp(lastActivityAt),
    lastActivityType: activityContact?.lastActivityType || "",
    lastActivityLabel: activityContact?.lastActivityLabel || "",
    needsAttention: isIdleForDays(lastActivityAt, IDLE_DAYS),
    campaignNames: uniqueSorted(members.map((item) => item.campaignName).filter(Boolean)),
    campaignIds: uniqueSorted(members.map((item) => item.campaignId).filter(Boolean)),
  };
}

function buildCompanyMetrics(companies) {
  const scored = companies.map((item) => item.score).filter((value) => value !== null);
  return {
    total: companies.length,
    scoredCompanies: scored.length,
    averageScore: scored.length ? scored.reduce((sum, value) => sum + value, 0) / scored.length : null,
    needsAttention: companies.filter((item) => item.needsAttention).length,
  };
}

function buildCompanyActivity(company) {
  const activities = [];
  company.contacts.forEach((contact) => {
    const raw = contact.raw || {};
    pushActivity(activities, {
      type: "meeting",
      at: raw.meetingBookedAt || raw.meeting?.createdAt || raw.meeting?.startAt,
      title: `Meeting booked with ${contact.name}`,
      copy: raw.meeting?.title || raw.meetingTitle || "",
      icon: Calendar,
      tone: "success",
    });
    pushActivity(activities, {
      type: "reply",
      at: raw.repliedAt || raw.replyAt || raw.responseAt,
      title: `${contact.name} replied`,
      copy: raw.replyPreview || raw.lastReply || "",
      icon: Mail,
      tone: "primary",
    });
    pushActivity(activities, {
      type: "call",
      at: raw.lastCallAt || raw.callCompletedAt || raw.callStartedAt,
      title: raw.lastCallOutcome
        ? `${contact.name} · ${titleCase(raw.lastCallOutcome)}`
        : `Call with ${contact.name}`,
      copy: raw.callSummary || raw.lastCall?.summary || "",
      icon: Phone,
      tone: "violet",
    });
    pushActivity(activities, {
      type: "email",
      at: raw.emailSentAt || raw.sentAt,
      title: `Email sent to ${contact.name}`,
      copy: raw.emailSubject || raw.subject || "",
      icon: Mail,
      tone: "neutral",
    });
    pushActivity(activities, {
      type: "added",
      at: contact.createdAt,
      title: `${contact.name} added`,
      copy: contact.campaignName ? `From ${contact.campaignName}` : "",
      icon: Users,
      tone: "neutral",
    });
  });

  return activities
    .filter((item) => item.at)
    .sort((left, right) => getTimestamp(right.at) - getTimestamp(left.at))
    .slice(0, 7);
}

function pushActivity(collection, item) {
  if (item.at) collection.push(item);
}

function getLatestContactActivity(raw, createdAt) {
  const candidates = [
    { at: raw.meetingBookedAt || raw.meeting?.createdAt || raw.meeting?.startAt, type: "meeting", label: "Meeting Booked" },
    { at: raw.repliedAt || raw.replyAt || raw.responseAt, type: "reply", label: "Reply Received" },
    { at: raw.contractSignedAt || raw.wonAt, type: "won", label: raw.contractSignedAt ? "Contract Signed" : "Closed Won" },
    { at: raw.proposalSentAt, type: "proposal", label: "Sent Proposal" },
    {
      at: raw.lastCallAt || raw.callCompletedAt || raw.callStartedAt,
      type: "call",
      label: raw.lastCallOutcome ? titleCase(raw.lastCallOutcome) : "Call Completed",
    },
    { at: raw.emailOpenedAt || raw.openedAt || raw.lastOpenedAt, type: "email_open", label: "Email Opened" },
    { at: raw.emailSentAt || raw.sentAt, type: "email", label: "Email Sent" },
    { at: raw.lastActivityAt || raw.updatedAt, type: "activity", label: "CRM Activity" },
    { at: createdAt, type: "created", label: "Contact Added" },
  ]
    .map((item) => ({ ...item, timestamp: getTimestamp(item.at) }))
    .filter((item) => item.timestamp > 0)
    .sort((left, right) => right.timestamp - left.timestamp);

  const latest = candidates[0];
  return latest
    ? { at: new Date(latest.timestamp).toISOString(), type: latest.type, label: latest.label }
    : { at: "", type: "", label: "" };
}

function pickCompanyStage(stages) {
  const clean = stages.map(normalizeStatus).filter(Boolean);
  if (!clean.length) return "new";
  const won = clean.find((stage) => ["closed_won", "won", "customer"].includes(stage));
  if (won) return won;
  return [...clean].sort((left, right) => getStagePriority(right) - getStagePriority(left))[0];
}

function getStagePriority(stage) {
  return STAGE_PRIORITY[normalizeStatus(stage)] ?? 0;
}

function getStageTone(stage) {
  const value = normalizeStatus(stage);
  if (["closed_won", "won", "customer"].includes(value)) return "won";
  if (["negotiation", "proposal", "meeting_booked"].includes(value)) return "primary";
  if (["qualified", "interested", "replied"].includes(value)) return "info";
  if (["lost", "closed_lost", "not_interested"].includes(value)) return "danger";
  return "neutral";
}

function getIndustryTone(industry) {
  const value = normalizeStatus(industry);
  if (value.includes("health") || value.includes("dental") || value.includes("medical")) return "health";
  if (value.includes("tech") || value.includes("software") || value.includes("saas")) return "tech";
  if (value.includes("finance") || value.includes("insurance")) return "finance";
  if (value.includes("real_estate") || value.includes("property")) return "property";
  return "default";
}

function normalizeDomain(value) {
  const string = String(value || "").trim();
  if (!string) return "";
  try {
    const candidate = /^https?:\/\//i.test(string) ? string : `https://${string}`;
    return new URL(candidate).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return string.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
  }
}

function getEmailDomain(email) {
  const value = String(email || "").trim();
  if (!value.includes("@")) return "";
  const domain = value.split("@").pop()?.toLowerCase() || "";
  const freeDomains = new Set([
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "aol.com",
    "proton.me",
    "protonmail.com",
  ]);
  return freeDomains.has(domain) ? "" : domain;
}

function normalizeWebsiteUrl(value) {
  const string = String(value || "").trim();
  if (!string) return "";
  return /^https?:\/\//i.test(string) ? string : `https://${string}`;
}

function normalizeCompanyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(incorporated|inc|llc|ltd|limited|corp|corporation|company|co)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function mostCommonValue(values) {
  if (!values.length) return "";
  const counts = new Map();
  values.forEach((value) => {
    const key = String(value || "").trim();
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return (
    Array.from(counts.entries()).sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })[0]?.[0] || ""
  );
}

function uniqueSorted(values) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function isIdleForDays(value, days) {
  const timestamp = getTimestamp(value);
  return timestamp ? Date.now() - timestamp > days * 24 * 60 * 60 * 1000 : false;
}

function compareNullableNumbersDesc(left, right) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
}

/* ========================================================================== */
/* Utilities                                                                  */
/* ========================================================================== */

function firstString(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const string = String(value).trim();
    if (string) return string;
  }
  return "";
}

function firstDateValue(...values) {
  for (const value of values) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return "";
}

function finiteNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Number(value)));
}

function getTimestamp(value) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeWorkspaceRole(value) {
  const role = normalizeStatus(value);
  if (role.includes("owner")) return "owner";
  if (role.includes("admin")) return "admin";
  if (role.includes("manager")) return "manager";
  if (
    role === "caller" ||
    role.includes("cold_caller") ||
    role.includes("sales_representative") ||
    role.includes("sales_rep") ||
    role.includes("telemarketer")
  ) return "caller";
  return role || "caller";
}

function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat().format(Math.round(number)) : "0";
}

function formatScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : "—";
}

function formatRelativeOrDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const delta = Date.now() - date.getTime();
  if (delta >= 0 && delta < 60 * 1000) return "Just now";
  if (delta >= 0 && delta < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.floor(delta / (60 * 1000)));
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }
  if (delta >= 0 && delta < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.floor(delta / (60 * 60 * 1000)));
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (delta >= 0 && delta < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.max(1, Math.floor(delta / (24 * 60 * 60 * 1000)));
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function getInitials(value) {
  const parts = String(value || "RF").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function getAvatarTone(value) {
  const tones = ["primary", "violet", "blue", "green", "amber"];
  const sum = String(value || "").split("").reduce((total, character) => total + character.charCodeAt(0), 0);
  return tones[sum % tones.length];
}

function buildPagination(page, count) {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1);
  const output = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(count - 1, page + 1);
  if (start > 2) output.push("…");
  for (let value = start; value <= end; value += 1) output.push(value);
  if (end < count - 1) output.push("…");
  output.push(count);
  return output;
}

function downloadCsv(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const string = String(value ?? "");
  return /[",\n\r]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string;
}

function formatFileDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function notify(type, title, message) {
  if (typeof window === "undefined") return;
  const bridge = window.reachflyToast;
  if (bridge && typeof bridge[type] === "function") {
    bridge[type](title, message);
    return;
  }
  window.dispatchEvent(new CustomEvent("reachfly:toast", { detail: { type, title, message } }));
}

function CompaniesStyles() {
  return (
    <style>{`
      .rf-companies-v7{--c:#4648d4;--cd:#3537bb;--cs:#e8e9ff;--v:#6b38d4;--vs:#f0eaff;--t:#191c1d;--ts:#464554;--m:#767586;--o:#e5e7eb;--os:#c7c4d7;--soft:#f3f4f5;--high:#e7e8e9;--ok:#087a51;--oks:#dcfce7;--err:#ba1a1a;--errs:#ffedeb;--ease:cubic-bezier(.2,.8,.2,1);width:100%;min-height:100%;padding:28px 32px 42px;color:var(--t);font-family:Inter,system-ui,sans-serif;animation:coPage .28s var(--ease)}
      .rf-companies-v7 *,.rf-companies-v7 *:before,.rf-companies-v7 *:after{box-sizing:border-box}.rf-companies-v7 a{color:inherit}.rf-companies-v7 .spin{animation:coSpin .8s linear infinite}
      @keyframes coPage{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes coUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}@keyframes coPop{from{opacity:0;transform:translateY(-5px) scale(.985)}to{opacity:1;transform:none}}@keyframes coDrawer{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}@keyframes coBack{from{opacity:0}to{opacity:1}}@keyframes coSpin{to{transform:rotate(360deg)}}@keyframes coShimmer{from{background-position:200% 0}to{background-position:-200% 0}}
      .rfco-eyebrow{display:block;margin-bottom:4px;color:var(--c);font-size:9px;font-weight:750;line-height:13px;letter-spacing:.09em;text-transform:uppercase}
      .rfco-header{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:28px}.rfco-header h1,.rfco-access h1{margin:0;color:var(--t);font:600 32px/40px Geist,Inter,sans-serif;letter-spacing:-.02em}.rfco-header p,.rfco-access p{margin:3px 0 0;color:var(--ts);font-size:14px;line-height:20px}.rfco-header-actions{display:flex;align-items:center;gap:10px}.rfco-filter-anchor{position:relative}
      .rfco-btn{appearance:none;min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:8px 14px;border:1px solid transparent;border-radius:8px;text-decoration:none;white-space:nowrap;cursor:pointer;font:600 11px/17px Inter,sans-serif;transition:.15s var(--ease)}.rfco-btn:hover:not(:disabled){transform:translateY(-1px)}.rfco-btn:disabled{opacity:.45;cursor:not-allowed}.rfco-btn-primary{color:#fff!important;background:var(--c);border-color:var(--c);box-shadow:0 5px 14px rgba(70,72,212,.18)}.rfco-btn-primary:hover:not(:disabled){background:var(--cd)}.rfco-btn-secondary{color:var(--t)!important;background:var(--soft);border-color:var(--soft)}.rfco-btn-secondary:hover:not(:disabled),.rfco-btn-secondary.active{color:var(--c)!important;background:var(--cs)}.rfco-filter-count{min-width:17px;height:17px;display:grid;place-items:center;padding:0 4px;color:#fff;background:var(--c);border-radius:99px;font-size:7px}
      .rfco-filter-popover{position:absolute;z-index:60;top:48px;right:0;width:min(340px,calc(100vw - 28px));padding:15px;background:#fff;border:1px solid var(--o);border-radius:13px;box-shadow:0 18px 45px rgba(25,28,29,.13);animation:coPop .17s var(--ease)}.rfco-popover-head{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:11px;margin-bottom:11px;border-bottom:1px solid var(--o)}.rfco-popover-head>div{display:grid}.rfco-popover-head strong{font:600 11px/16px Geist,Inter,sans-serif}.rfco-popover-head span{color:var(--m);font-size:8px}.rfco-popover-head button,.rfco-search button{width:26px;height:26px;display:grid;place-items:center;padding:0;color:var(--m);background:transparent;border:0;border-radius:6px;cursor:pointer}.rfco-field{display:grid;gap:5px;margin-bottom:10px}.rfco-field>span{color:var(--ts);font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.rfco-field select{width:100%;height:37px;padding:0 9px;color:var(--t);background:#fff;border:1px solid var(--o);border-radius:7px;outline:0;font-size:9px}.rfco-toggle-row{display:flex;align-items:flex-start;gap:8px;padding:9px;background:var(--soft);border-radius:8px;cursor:pointer}.rfco-toggle-row input{margin-top:2px;accent-color:var(--c)}.rfco-toggle-row>span{display:grid}.rfco-toggle-row strong{font-size:9px}.rfco-toggle-row small{color:var(--m);font-size:7px}.rfco-popover-actions{display:flex;justify-content:flex-end;gap:7px;padding-top:11px;margin-top:10px;border-top:1px solid var(--o)}.rfco-popover-actions button{min-height:33px;padding:6px 10px;border:0;border-radius:7px;cursor:pointer;font-size:9px;font-weight:700}.rfco-popover-actions .ghost{background:transparent}.rfco-popover-actions .primary{color:#fff;background:var(--c)}
      .rfco-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin-bottom:30px}.rfco-metric{position:relative;min-height:132px;display:flex;flex-direction:column;justify-content:space-between;gap:9px;overflow:hidden;padding:24px 26px 20px;background:#fff;border:1px solid #eff0f2;border-radius:14px;box-shadow:0 1px 2px rgba(25,28,29,.025);animation:coUp .29s var(--ease) both}.rfco-metric:nth-child(2){animation-delay:.045s}.rfco-metric:nth-child(3){animation-delay:.09s}.rfco-metric-orb{position:absolute;top:-36px;right:-28px;width:108px;height:108px;background:var(--cs);border-radius:50%;opacity:.48}.rfco-metric.violet .rfco-metric-orb{background:var(--vs)}.rfco-metric.danger .rfco-metric-orb{background:var(--errs)}.rfco-metric-label{position:relative;display:flex;align-items:center;gap:7px;color:var(--ts)}.rfco-metric-label>span{color:var(--c)}.rfco-metric.violet .rfco-metric-label>span{color:var(--v)}.rfco-metric.danger .rfco-metric-label>span{color:var(--err)}.rfco-metric-label strong{font-size:9px;letter-spacing:.09em;text-transform:uppercase}.rfco-metric-value{position:relative;display:flex;align-items:baseline;gap:7px}.rfco-metric-value>strong{font:600 30px/35px Geist,Inter,sans-serif;letter-spacing:-.025em}.rfco-metric.danger .rfco-metric-value>strong{color:var(--err)}.rfco-metric-value>span{color:var(--ts);font-size:10px}.rfco-metric>small{position:relative;color:var(--m);font-size:8px}
      .rfco-bulk-bar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:9px 12px;margin-bottom:10px;color:#fff;background:var(--c);border-radius:9px;animation:coUp .18s var(--ease)}.rfco-bulk-bar>div{display:flex;align-items:center;gap:7px}.rfco-bulk-bar>div:first-child>span{width:25px;height:25px;display:grid;place-items:center;background:#ffffff22;border-radius:7px}.rfco-bulk-bar strong{font-size:10px}.rfco-bulk-bar small{opacity:.82;font-size:8px}.rfco-bulk-bar button,.rfco-bulk-bar a{min-height:29px;display:inline-flex;align-items:center;gap:5px;padding:5px 8px;color:#fff!important;background:#ffffff1a;border:0;border-radius:6px;text-decoration:none;cursor:pointer;font-size:8px;font-weight:700}
      .rfco-message{display:flex;align-items:flex-start;gap:9px;padding:10px 12px;margin-bottom:10px;border:1px solid;border-radius:9px;animation:coUp .18s var(--ease)}.rfco-message.error{color:#7c1616;background:var(--errs);border-color:#ffd0cc}.rfco-message>span{width:26px;height:26px;display:grid;place-items:center;background:#ffffffb3;border-radius:7px}.rfco-message>div{min-width:0;flex:1;display:grid}.rfco-message strong{font-size:10px}.rfco-message small{font-size:9px}.rfco-message>button{align-self:center;padding:5px 8px;color:inherit;background:#ffffffad;border:0;border-radius:6px;cursor:pointer;font-size:8px;font-weight:700}
      .rfco-table-card{min-height:470px;background:#fff;border:1px solid #eff0f2;border-radius:14px;box-shadow:0 1px 2px rgba(25,28,29,.04),0 4px 14px rgba(25,28,29,.025)}.rfco-table-toolbar{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px 18px;background:var(--soft);border-radius:14px 14px 0 0}.rfco-table-title{display:flex;align-items:center;gap:9px}.rfco-table-title>span{width:30px;height:30px;display:grid;place-items:center;color:var(--c);background:var(--cs);border-radius:9px}.rfco-table-title strong{font:600 12px/17px Geist,Inter,sans-serif}.rfco-table-title i{min-width:30px;height:21px;display:grid;place-items:center;padding:0 7px;color:var(--ts);background:#e4e5e6;border-radius:99px;font-size:8px;font-style:normal;font-weight:700}.rfco-table-tools{display:flex;align-items:center;gap:7px}.rfco-search{width:min(300px,32vw);height:39px;display:flex;align-items:center;gap:7px;padding:0 10px;color:var(--m);background:#fff;border:1px solid transparent;border-radius:8px}.rfco-search:focus-within{border-color:#4648d466;box-shadow:0 0 0 3px #4648d414}.rfco-search input{min-width:0;flex:1;height:37px;padding:0;color:var(--t);background:transparent;border:0;outline:0;font:400 10px/15px Inter,sans-serif}.rfco-refresh{width:38px;height:38px;display:grid;place-items:center;padding:0;color:var(--ts);background:#fff;border:0;border-radius:8px;cursor:pointer}.rfco-refresh:hover{color:var(--c);background:var(--cs)}
      .rfco-table-wrap{width:100%;overflow:auto}.rfco-table{width:100%;min-width:1120px;border-collapse:separate;border-spacing:0;white-space:nowrap;text-align:left}.rfco-table thead th{padding:12px 13px;color:var(--ts);background:#eceeef;border-bottom:1px solid var(--o);font-size:8px;font-weight:650;letter-spacing:.07em;text-transform:uppercase}.rfco-table th:first-child,.rfco-table td:first-child{padding-left:18px}.rfco-table th:last-child,.rfco-table td:last-child{padding-right:18px}.rfco-table .select{width:46px;text-align:center}.rfco-table .score,.rfco-table .activity{text-align:right}.rfco-table tbody tr{cursor:pointer;animation:coUp .23s var(--ease) both;animation-delay:calc(var(--rfco-row-index)*.024s);transition:.14s var(--ease)}.rfco-table tbody tr+tr td{border-top:1px solid #f3f3f4}.rfco-table tbody tr:nth-child(even){background:#fcfcfd}.rfco-table tbody tr:hover{background:#f8f8fb;box-shadow:inset 3px 0 0 #4648d494}.rfco-table tbody tr.selected{background:#f2f2ff;box-shadow:inset 3px 0 0 var(--c)}.rfco-table tbody td{height:76px;padding:13px;color:var(--ts);font-size:10px;vertical-align:middle}
      .rfco-checkbox{width:19px;height:19px;display:grid;place-items:center;margin:auto;padding:0;color:#fff;background:#fff;border:1px solid var(--os);border-radius:4px;cursor:pointer}.rfco-checkbox.checked{background:var(--c);border-color:var(--c)}.rfco-company-identity{min-width:235px;display:flex;align-items:center;gap:11px}.rfco-company-logo,.rfco-profile-logo{display:grid;place-items:center;color:#fff;font-weight:800}.rfco-company-logo{width:36px;height:36px;flex:0 0 36px;border-radius:8px;font-size:8px}.rfco-company-logo.primary,.rfco-profile-logo.primary,.rfco-contact-stack .primary,.rfco-drawer-contact>.primary{background:#5b5ddd}.rfco-company-logo.violet,.rfco-profile-logo.violet,.rfco-contact-stack .violet,.rfco-drawer-contact>.violet{background:#7546d9}.rfco-company-logo.blue,.rfco-profile-logo.blue,.rfco-contact-stack .blue,.rfco-drawer-contact>.blue{background:#3772b9}.rfco-company-logo.green,.rfco-profile-logo.green,.rfco-contact-stack .green,.rfco-drawer-contact>.green{background:#23845f}.rfco-company-logo.amber,.rfco-profile-logo.amber,.rfco-contact-stack .amber,.rfco-drawer-contact>.amber{background:#a06e25}.rfco-company-identity>span:last-child{min-width:0;display:grid}.rfco-company-identity strong{max-width:230px;overflow:hidden;color:var(--t);text-overflow:ellipsis;font:600 11px/15px Geist,Inter,sans-serif}.rfco-company-identity small{max-width:230px;overflow:hidden;text-overflow:ellipsis;font-size:8px}
      .rfco-industry{min-height:23px;display:inline-flex;align-items:center;max-width:130px;overflow:hidden;padding:4px 8px;color:#53607a;background:#e9eefc;border-radius:5px;text-overflow:ellipsis;font-size:8px}.rfco-industry.tech{color:#4348c0;background:#e8e9ff}.rfco-industry.finance{color:#6e4f00;background:#fff1c8}.rfco-industry.property{color:#5d3da8;background:#f0eaff}.rfco-industry.default{color:#5e5d69;background:#eff0f1}.rfco-location{max-width:175px;display:flex;align-items:center;gap:5px;overflow:hidden;text-overflow:ellipsis}.rfco-contact-stack{display:flex;align-items:center;min-width:84px}.rfco-contact-stack span,.rfco-contact-stack i{width:27px;height:27px;display:grid;place-items:center;flex:0 0 27px;margin-left:-7px;color:#fff;border:2px solid #fff;border-radius:50%;font-size:6px;font-style:normal;font-weight:800}.rfco-contact-stack span:first-child{margin-left:0}.rfco-contact-stack i{color:var(--ts);background:var(--high)}
      .rfco-stage{min-height:23px;display:inline-flex;align-items:center;max-width:105px;overflow:hidden;padding:4px 8px;border-radius:5px;text-overflow:ellipsis;font-size:8px;font-weight:700}.rfco-stage.primary{color:#5a28ce;background:#eadfff}.rfco-stage.info{color:#3159b7;background:#e7edff}.rfco-stage.won{color:#4648d4;background:#dcdcff}.rfco-stage.danger{color:var(--err);background:var(--errs)}.rfco-stage.neutral{color:#555763;background:#e5e6e8}.rfco-owner{max-width:135px;display:inline-flex;align-items:center;gap:7px}.rfco-owner i{width:23px;height:23px;display:grid;place-items:center;flex:0 0 23px;color:#fff;background:var(--v);border-radius:50%;font-size:6px;font-style:normal;font-weight:800}.rfco-owner>span{overflow:hidden;text-overflow:ellipsis}.rfco-unassigned{color:var(--m);font-size:9px}
      .rfco-score{display:inline-flex;align-items:center;justify-content:flex-end;gap:7px}.rfco-score>strong{min-width:22px;text-align:right;font:600 11px/15px Geist,Inter,sans-serif}.rfco-score>i{width:24px;height:24px;display:block;background:radial-gradient(circle,#fff 58%,transparent 60%),conic-gradient(var(--c) calc(var(--rfco-score)*1%),#e2e3e6 0);border-radius:50%}.rfco-score.medium>i{background:radial-gradient(circle,#fff 58%,transparent 60%),conic-gradient(#8a6a17 calc(var(--rfco-score)*1%),#e2e3e6 0)}.rfco-score.low>i{background:radial-gradient(circle,#fff 58%,transparent 60%),conic-gradient(var(--err) calc(var(--rfco-score)*1%),#e2e3e6 0)}.rfco-score-empty{color:var(--m)}.rfco-last-activity{display:inline-grid;justify-items:end}.rfco-last-activity strong{max-width:145px;overflow:hidden;color:var(--t);text-overflow:ellipsis;font-size:9px;font-weight:500}.rfco-last-activity small{color:var(--m);font-size:7px}.rfco-last-activity.attention strong,.rfco-last-activity.attention small{color:var(--err)}
      .rfco-footer{min-height:59px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 18px;color:var(--ts);background:#fafafb;border-top:1px solid var(--o);border-radius:0 0 14px 14px;font-size:9px}.rfco-pagination{display:flex;align-items:center;gap:4px}.rfco-pagination button{min-width:29px;height:29px;display:grid;place-items:center;padding:0 6px;color:var(--ts);background:transparent;border:0;border-radius:6px;cursor:pointer;font-size:8px}.rfco-pagination button.active{color:var(--t);background:#e5e6e8}.rfco-pagination button:disabled{opacity:.35}.rfco-pagination>span{width:20px;text-align:center;color:var(--m);font-size:8px}.rfco-mobile-list{display:none}
      .rfco-skeleton-head,.rfco-skeleton-row{display:grid;grid-template-columns:34px 2.4fr 1fr 1.4fr 1fr 1fr 1.25fr 1fr;align-items:center;gap:14px;padding:13px 18px}.rfco-skeleton-head{background:#eceeef}.rfco-skeleton-row+.rfco-skeleton-row{border-top:1px solid #f1f2f3}.rfco-skeleton i{height:10px;display:block;background:linear-gradient(90deg,#eceef0 25%,#f8f9fa 45%,#eceef0 65%);background-size:220% 100%;border-radius:99px;animation:coShimmer 1.3s linear infinite}.rfco-skeleton-row i.identity{height:35px;border-radius:8px}.rfco-empty{min-height:390px;display:grid;place-items:center;align-content:center;gap:6px;padding:34px 20px;text-align:center}.rfco-empty>span{width:52px;height:52px;display:grid;place-items:center;color:var(--c);background:var(--cs);border-radius:15px}.rfco-empty h2{margin:0;font:600 15px/21px Geist,Inter,sans-serif}.rfco-empty p{max-width:500px;margin:0;color:var(--ts);font-size:10px}.rfco-empty>div{display:flex;gap:7px;margin-top:8px}
      .rfco-drawer-backdrop{position:fixed;z-index:190;inset:0;display:flex;justify-content:flex-end;background:#191c1d3d;backdrop-filter:blur(2px);animation:coBack .15s ease-out}.rfco-drawer{width:min(430px,100vw);height:100%;display:flex;flex-direction:column;overflow:auto;background:#fff;border-left:1px solid var(--o);box-shadow:-18px 0 50px #191c1d1f;animation:coDrawer .24s var(--ease)}.rfco-drawer-top{min-height:56px;display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--o)}.rfco-drawer-top .rfco-eyebrow{margin:0}.rfco-drawer-top button{width:30px;height:30px;display:grid;place-items:center;padding:0;color:var(--m);background:transparent;border:0;border-radius:7px;cursor:pointer}.rfco-company-profile{display:grid;justify-items:center;gap:4px;padding:24px 22px 20px;text-align:center;background:radial-gradient(circle at 78% 0,#4648d417,transparent 34%),#fff;border-bottom:1px solid var(--o)}.rfco-profile-logo{width:72px;height:72px;margin-bottom:6px;border:4px solid #fff;border-radius:18px;box-shadow:0 5px 18px #191c1d21;font-size:18px}.rfco-company-profile h2{margin:0;font:600 18px/24px Geist,Inter,sans-serif}.rfco-company-profile p{margin:0 0 4px;color:var(--ts);font-size:10px}.rfco-profile-chips,.rfco-profile-actions{display:flex;align-items:center;gap:7px}.rfco-profile-actions{margin-top:9px}.rfco-profile-actions a,.rfco-profile-actions button{width:34px;height:34px;display:grid;place-items:center;padding:0;color:var(--ts);background:var(--soft);border:0;border-radius:50%;text-decoration:none}.rfco-profile-actions a:hover{color:var(--c);background:var(--cs)}.rfco-profile-actions button:disabled{opacity:.35}
      .rfco-drawer-section{padding:18px 20px;border-bottom:1px solid var(--o)}.rfco-drawer-section.grow{flex:1}.rfco-drawer-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px}.rfco-drawer-section-head>span:first-child{color:var(--ts);font-size:9px;font-weight:750;letter-spacing:.09em;text-transform:uppercase}.rfco-drawer-section-head>a{color:var(--c)!important;text-decoration:none;font-size:8px;font-weight:700}.rfco-detail-list{display:grid;gap:8px;margin:0}.rfco-detail-list>div{display:grid;grid-template-columns:110px 1fr;gap:12px}.rfco-detail-list dt{color:var(--ts);font-size:9px}.rfco-detail-list dd{margin:0;text-align:right;font-size:9px;font-weight:550}.rfco-drawer-contacts{display:grid;gap:4px}.rfco-drawer-contact{min-height:45px;display:flex;align-items:center;gap:8px;padding:6px 7px;border-radius:8px}.rfco-drawer-contact:hover{background:var(--soft)}.rfco-drawer-contact>span{width:29px;height:29px;display:grid;place-items:center;flex:0 0 29px;color:#fff;border-radius:50%;font-size:7px;font-weight:800}.rfco-drawer-contact>div:nth-child(2){min-width:0;flex:1;display:grid}.rfco-drawer-contact strong,.rfco-drawer-contact small{overflow:hidden;text-overflow:ellipsis}.rfco-drawer-contact strong{font-size:9px}.rfco-drawer-contact small{color:var(--m);font-size:7px}.rfco-drawer-contact>div:last-child{display:flex;gap:3px}.rfco-drawer-contact>div:last-child a{width:25px;height:25px;display:grid;place-items:center;color:var(--c)!important;background:var(--cs);border-radius:6px;text-decoration:none}.rfco-campaign-list{display:flex;flex-wrap:wrap;gap:5px}.rfco-campaign-list>span{min-height:27px;display:inline-flex;align-items:center;gap:4px;max-width:100%;overflow:hidden;padding:5px 7px;color:var(--c);background:var(--cs);border-radius:6px;text-overflow:ellipsis;font-size:7px;font-weight:700}.rfco-muted-copy{color:var(--m);font-size:8px}
      .rfco-activity-item{display:grid;grid-template-columns:28px 1fr;gap:8px;min-height:60px}.rfco-activity-rail{position:relative;display:flex;flex-direction:column;align-items:center}.rfco-activity-rail>span{position:relative;z-index:1;width:24px;height:24px;display:grid;place-items:center;color:var(--ts);background:#eef1f5;border-radius:50%}.rfco-activity-rail>span.primary{color:var(--c);background:var(--cs)}.rfco-activity-rail>span.success{color:var(--ok);background:var(--oks)}.rfco-activity-rail>span.violet{color:var(--v);background:var(--vs)}.rfco-activity-rail>i{position:absolute;top:24px;bottom:0;width:1px;background:var(--o)}.rfco-activity-item>div:last-child{display:grid;align-content:start;padding:2px 0 12px}.rfco-activity-item strong{font-size:9px}.rfco-activity-item small{color:var(--m);font-size:7px}.rfco-activity-item p{margin:3px 0 0;padding:6px 7px;color:var(--ts);background:var(--soft);border-radius:6px;font-size:7px}.rfco-drawer-empty{min-height:90px;display:grid;place-items:center;align-content:center;gap:5px;color:var(--m);text-align:center}.rfco-drawer-empty span{max-width:260px;font-size:8px}.rfco-drawer-footer{position:sticky;bottom:0;display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;padding:12px 14px;background:#fffffff5;border-top:1px solid var(--o);backdrop-filter:blur(10px)}.rfco-drawer-footer .rfco-btn{min-width:0;min-height:35px;padding:6px 8px;font-size:8px}
      .rfco-access{max-width:620px;padding:28px;background:#fff;border:1px solid var(--o);border-radius:15px}.rfco-access-icon{width:46px;height:46px;display:grid;place-items:center;margin-bottom:14px;color:var(--c);background:var(--cs);border-radius:13px}.rfco-access .rfco-btn{margin-top:18px}
      @media(max-width:1080px){.rf-companies-v7{padding:24px}.rfco-metrics{gap:14px}.rfco-header{align-items:flex-start;flex-direction:column}.rfco-header-actions{width:100%;justify-content:flex-end}}
      @media(max-width:850px){.rf-companies-v7{padding:20px 18px 84px}.rfco-metrics{grid-template-columns:1fr;gap:9px}.rfco-metric{min-height:106px;padding:17px 19px}.rfco-table-wrap{display:none}.rfco-mobile-list{display:grid}.rfco-mobile-card{display:grid;gap:10px;padding:14px 15px;animation:coUp .22s var(--ease) both;animation-delay:calc(var(--rfco-row-index)*.024s)}.rfco-mobile-card+.rfco-mobile-card{border-top:1px solid var(--o)}.rfco-mobile-card.selected{background:#f2f2ff}.rfco-mobile-head{display:flex;align-items:center;gap:9px}.rfco-mobile-head .rfco-checkbox{margin:0}.rfco-mobile-open{min-width:0;flex:1;display:flex;align-items:center;gap:8px;padding:0;color:inherit;background:transparent;border:0;text-align:left}.rfco-mobile-open .rfco-company-identity{min-width:0;flex:1}.rfco-mobile-meta{display:flex;gap:7px;padding-left:28px}.rfco-mobile-details{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;padding-left:28px}.rfco-mobile-details>span{display:flex;align-items:center;gap:5px;color:var(--ts);font-size:8px}.rfco-mobile-details .rfco-owner{grid-column:1/-1}.rfco-mobile-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0 0 28px;border-top:1px solid #f0f1f2}}
      @media(max-width:650px){.rf-companies-v7{padding:18px 12px 84px}.rfco-header h1,.rfco-access h1{font-size:25px;line-height:32px}.rfco-header p{font-size:11px}.rfco-header-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.rfco-header-actions .rfco-filter-anchor>.rfco-btn{width:100%}.rfco-header-actions>.rfco-btn-primary{grid-column:1/-1}.rfco-filter-popover{position:fixed;z-index:205;right:10px;bottom:74px;left:10px;top:auto;width:auto;max-height:72vh;overflow:auto}.rfco-table-toolbar{align-items:stretch;flex-direction:column;gap:8px}.rfco-table-tools{width:100%}.rfco-search{width:auto;flex:1}.rfco-bulk-bar{align-items:flex-start;flex-direction:column}.rfco-bulk-bar>div:last-child{width:100%}.rfco-bulk-bar button,.rfco-bulk-bar a{flex:1;justify-content:center}.rfco-footer{align-items:flex-start;flex-direction:column}.rfco-pagination{width:100%;justify-content:flex-end}.rfco-drawer{width:100vw}.rfco-drawer-footer{padding-bottom:calc(12px + env(safe-area-inset-bottom))}}
      @media(max-width:430px){.rfco-mobile-details{grid-template-columns:1fr}.rfco-mobile-details .rfco-owner{grid-column:auto}.rfco-drawer-footer{grid-template-columns:1fr}.rfco-empty>div{width:100%;flex-direction:column}.rfco-empty .rfco-btn{width:100%}}
      @media(prefers-reduced-motion:reduce){.rf-companies-v7,.rfco-metric,.rfco-table tbody tr,.rfco-mobile-card,.rfco-filter-popover,.rfco-bulk-bar,.rfco-message,.rfco-drawer-backdrop,.rfco-drawer,.rfco-skeleton i,.rf-companies-v7 .spin{animation:none!important}.rf-companies-v7 *{transition-duration:.01ms!important;scroll-behavior:auto!important}}
    `}</style>
  );
}
