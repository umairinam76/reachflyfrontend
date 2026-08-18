import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  Users,
} from "../components/icons";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  upgradeApi,
} from "../api";

export default function CampaignTeamAssignment({
  campaign,
  onAssigned,
}) {
  const {
    user,
  } = useAuth();

  const [
    members,
    setMembers,
  ] = useState([]);

  const [
    selected,
    setSelected,
  ] = useState([]);

  const [
    onlyUnassigned,
    setOnlyUnassigned,
  ] = useState(true);

  const [
    loadingMembers,
    setLoadingMembers,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const role = normalizeRole(
    user?.workspaceRole ||
      user?.role ||
      ""
  );

  const isManager =
    role === "manager";

  const permissions =
    Array.isArray(
      user?.permissions
    )
      ? user.permissions
      : [];

  const canAssign =
    isManager &&
    permissions.includes(
      "assign_leads"
    );

  useEffect(() => {
    let active = true;

    async function loadCallers() {
      if (!canAssign) {
        if (active) {
          setMembers([]);
          setSelected([]);
          setLoadingMembers(false);
        }

        return;
      }

      setLoadingMembers(true);
      setError("");

      try {
        const result =
          await upgradeApi.team();

        const rawMembers =
          Array.isArray(result)
            ? result
            : Array.isArray(
                  result?.members
                )
              ? result.members
              : Array.isArray(
                    result?.users
                  )
                ? result.users
                : [];

        const callers =
          rawMembers
            .filter(Boolean)
            .filter(
              (member) =>
                normalizeRole(
                  member.workspaceRole ||
                    member.role ||
                    ""
                ) === "caller"
            )
            .filter(
              (member) =>
                member.active !== false &&
                member.isActive !== false &&
                member.status !==
                  "suspended"
            );

        if (!active) {
          return;
        }

        setMembers(callers);

        setSelected(
          callers.map(
            (member) =>
              member.id
          )
        );
      } catch (requestError) {
        if (!active) {
          return;
        }

        setMembers([]);
        setSelected([]);

        setError(
          requestError?.message ||
            "The caller list could not be loaded."
        );
      } finally {
        if (active) {
          setLoadingMembers(false);
        }
      }
    }

    void loadCallers();

    return () => {
      active = false;
    };
  }, [
    canAssign,
    campaign?.id,
  ]);

  const leads =
    useMemo(
      () =>
        Array.isArray(
          campaign?.leads
        )
          ? campaign.leads
          : [],
      [
        campaign,
      ]
    );

  const eligibleLeads =
    useMemo(
      () =>
        leads.filter(
          (lead) =>
            ![
              "do_not_call",
              "do_not_contact",
              "not_interested",
            ].includes(
              normalizeStatus(
                lead?.status
              )
            )
        ),
      [
        leads,
      ]
    );

  const unassigned =
    useMemo(
      () =>
        eligibleLeads.filter(
          (lead) =>
            !getAssigneeId(
              lead
            )
        ).length,
      [
        eligibleLeads,
      ]
    );

  const assigned =
    eligibleLeads.length -
    unassigned;

  function toggle(
    memberId
  ) {
    setSelected(
      (current) =>
        current.includes(
          memberId
        )
          ? current.filter(
              (item) =>
                item !==
                memberId
            )
          : [
              ...current,
              memberId,
            ]
    );
  }

  function selectAll() {
    setSelected(
      members.map(
        (member) =>
          member.id
      )
    );
  }

  function clearSelection() {
    setSelected([]);
  }

  async function assign() {
    if (
      !canAssign ||
      !campaign?.id ||
      selected.length === 0
    ) {
      return;
    }

    const assignableCount =
      onlyUnassigned
        ? unassigned
        : eligibleLeads.length;

    if (
      assignableCount === 0
    ) {
      setError(
        onlyUnassigned
          ? "There are no unassigned eligible leads."
          : "There are no eligible leads to assign."
      );

      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const result =
        await upgradeApi.bulkAssignLeads(
          campaign.id,
          {
            memberIds:
              selected,

            assigneeIds:
              selected,

            strategy:
              "round_robin",

            onlyUnassigned,

            leadIds:
              eligibleLeads
                .filter(
                  (lead) =>
                    !onlyUnassigned ||
                    !getAssigneeId(
                      lead
                    )
                )
                .map(
                  (lead) =>
                    lead.id ||
                    lead.placeId
                )
                .filter(Boolean),
          }
        );

      const updated =
        Number(
          result?.updated ??
            result?.assigned ??
            result?.count ??
            assignableCount
        );

      const successMessage =
        `${updated} lead${
          updated === 1
            ? ""
            : "s"
        } assigned to ${
          selected.length
        } caller${
          selected.length === 1
            ? ""
            : "s"
        } using round robin.`;

      setMessage(
        successMessage
      );

      notifyCampaignAssignment(
        "success",
        "Leads distributed",
        successMessage
      );

      await onAssigned?.(
        result
      );
    } catch (requestError) {
      const message =
        requestError?.message ||
        "The leads could not be assigned.";

      setError(
        message
      );

      notifyCampaignAssignment(
        "error",
        "Lead distribution failed",
        message
      );
    } finally {
      setSaving(false);
    }
  }

  if (!isManager) {
    return null;
  }

  return (
    <section className="cardish rf-campaign-assignment rf-campaign-assignment-v7 mt24">
      <CampaignTeamAssignmentV7Styles />
      <div className="section-title-row">
        <div>
          <span className="eyebrow">
            Lead distribution
          </span>

          <h2>
            Assign ready leads to callers
          </h2>

          <p>
            {unassigned} unassigned ·{" "}
            {assigned} already assigned ·{" "}
            {eligibleLeads.length} eligible
          </p>
        </div>

        <Users />
      </div>

      {!canAssign ? (
        <div className="error-banner">
          Your manager account does not currently have lead-assignment access.
          Ask a workspace administrator to enable this permission, then sign in again.
        </div>
      ) : null}

      {error ? (
        <p
          className="error-banner"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {message ? (
        <p
          className="success-banner"
          role="status"
        >
          {message}
        </p>
      ) : null}

      {loadingMembers ? (
        <div className="skeleton-list">
          <i />
          <i />
        </div>
      ) : members.length ? (
        <>
          <div className="flex flex-between mb12">
            <div>
              <b>
                Select callers
              </b>

              <small className="text-muted">
                {" "}
                · {selected.length} selected
              </small>
            </div>

            <div className="flex flex-gap">
              <button
                type="button"
                className="btn ghost small"
                onClick={
                  selectAll
                }
                disabled={
                  selected.length ===
                  members.length
                }
              >
                Select all
              </button>

              <button
                type="button"
                className="btn ghost small"
                onClick={
                  clearSelection
                }
                disabled={
                  selected.length ===
                  0
                }
              >
                Clear
              </button>
            </div>
          </div>

          <div className="rf-assignee-picker">
            {members.map(
              (member) => {
                const checked =
                  selected.includes(
                    member.id
                  );

                return (
                  <label
                    key={
                      member.id
                    }
                    className={
                      checked
                        ? "selected"
                        : ""
                    }
                  >
                    <input
                      type="checkbox"
                      checked={
                        checked
                      }
                      onChange={() =>
                        toggle(
                          member.id
                        )
                      }
                    />

                    <MemberAvatar
                      member={
                        member
                      }
                    />

                    <span>
                      <b>
                        {member.name ||
                          member.fullName ||
                          member.email ||
                          "Caller"}
                      </b>

                      <small>
                        {member.jobTitle ||
                          "Caller"}
                        {member.email
                          ? ` · ${member.email}`
                          : ""}
                      </small>
                    </span>
                  </label>
                );
              }
            )}
          </div>

          <label className="rf-assignment-option">
            <input
              type="checkbox"
              checked={
                onlyUnassigned
              }
              onChange={(
                event
              ) =>
                setOnlyUnassigned(
                  event.target
                    .checked
                )
              }
            />

            Assign only leads that are currently
            unassigned
          </label>

          <div className="flex flex-gap mt16">
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                void assign();
              }}
              disabled={
                saving ||
                !canAssign ||
                selected.length ===
                  0 ||
                (
                  onlyUnassigned
                    ? unassigned ===
                      0
                    : eligibleLeads.length ===
                      0
                )
              }
            >
              {saving
                ? "Assigning…"
                : "Distribute leads evenly"}
            </button>

            <small className="text-muted">
              Assigned leads appear automatically on each
              caller's My Leads dashboard.
            </small>
          </div>
        </>
      ) : (
        <div className="safe-note-v54">
          Add active caller accounts before distributing
          this list.{" "}

          <Link to="/app/role-operations?tab=team">
            Open Team
          </Link>
        </div>
      )}
    </section>
  );
}

function MemberAvatar({
  member,
}) {
  const name =
    member?.name ||
    member?.fullName ||
    member?.email ||
    "Caller";

  const avatarUrl =
    member?.avatarUrl ||
    member?.photoUrl ||
    member?.profileImage ||
    member?.profileImageUrl ||
    "";

  return (
    <span className="rf-assignee-avatar">
      {avatarUrl ? (
        <img
          src={
            avatarUrl
          }
          alt={name}
          loading="lazy"
        />
      ) : (
        getInitials(
          name
        )
      )}
    </span>
  );
}

function getAssigneeId(
  lead = {}
) {
  return (
    lead.assigneeId ||
    lead.assignedTo ||
    lead.assignedUserId ||
    lead.assignment?.assigneeId ||
    ""
  );
}

function normalizeStatus(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      "_"
    )
    .replace(
      /-/g,
      "_"
    );
}

function normalizeRole(
  value
) {
  const role =
    normalizeStatus(
      value
    );

  if (
    role.includes(
      "owner"
    )
  ) {
    return "owner";
  }

  if (
    role.includes(
      "admin"
    )
  ) {
    return "admin";
  }

  if (
    role.includes(
      "manager"
    )
  ) {
    return "manager";
  }

  if (
    role === "caller" ||
    role.includes(
      "cold_caller"
    ) ||
    role.includes(
      "sales_representative"
    ) ||
    role.includes(
      "sales_rep"
    ) ||
    role.includes(
      "telemarketer"
    )
  ) {
    return "caller";
  }

  return role ||
    "caller";
}

function getInitials(
  value
) {
  return String(
    value || "C"
  )
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part.charAt(0)
          .toUpperCase()
    )
    .join("") ||
    "C";
}


function notifyCampaignAssignment(
  type,
  title,
  message
) {
  if (typeof window === "undefined") {
    return;
  }

  const bridge =
    window.reachflyToast;

  if (
    bridge &&
    typeof bridge[type] === "function"
  ) {
    bridge[type](title, message);
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

function CampaignTeamAssignmentV7Styles() {
  return (
    <style>{`
      .rf-campaign-assignment-v7{
        --rfca-text:#191c1d;
        --rfca-text2:#4d4c59;
        --rfca-muted:#777784;
        --rfca-line:#e2e4e7;
        --rfca-primary:#4648d4;
        --rfca-primary-dark:#393bbb;
        --rfca-primary-soft:#e8e9ff;
        --rfca-green:#087a51;
        --rfca-green-soft:#e4f7ee;
        --rfca-red:#ba1a1a;
        --rfca-red-soft:#ffedeb;
        --rfca-ease:cubic-bezier(.2,.8,.2,1);
        display:grid;
        gap:10px;
        padding:14px!important;
        color:var(--rfca-text);
        background:
          radial-gradient(circle at 94% 5%,rgba(70,72,212,.055),transparent 31%),
          #fff!important;
        border:1px solid #dedffa!important;
        border-radius:12px!important;
        box-shadow:0 1px 3px rgba(25,28,29,.025)!important;
      }

      .rf-campaign-assignment-v7 *,
      .rf-campaign-assignment-v7 *::before,
      .rf-campaign-assignment-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfcaIn{
        from{opacity:0;transform:translateY(-4px)}
        to{opacity:1;transform:none}
      }

      .rf-campaign-assignment-v7 .section-title-row{
        min-height:68px;
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
        padding-bottom:10px;
        border-bottom:1px solid #eff0f1;
      }

      .rf-campaign-assignment-v7 .section-title-row > div{
        min-width:0;
      }

      .rf-campaign-assignment-v7 .section-title-row > svg{
        width:38px;
        height:38px;
        padding:9px;
        color:var(--rfca-primary);
        background:var(--rfca-primary-soft);
        border-radius:9px;
      }

      .rf-campaign-assignment-v7 .eyebrow{
        display:block;
        margin-bottom:3px;
        color:var(--rfca-primary);
        font-size:5.7px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rf-campaign-assignment-v7 h2{
        margin:0;
        font:600 15px/20px Geist,Inter,sans-serif;
        letter-spacing:-.015em;
      }

      .rf-campaign-assignment-v7 .section-title-row p{
        margin:4px 0 0;
        color:var(--rfca-text2);
        font-size:6.3px;
        line-height:10px;
      }

      .rf-campaign-assignment-v7 .error-banner,
      .rf-campaign-assignment-v7 .success-banner{
        padding:10px 11px;
        margin:0;
        border:1px solid;
        border-radius:8px;
        font-size:6.4px;
        line-height:10px;
        animation:rfcaIn .16s var(--rfca-ease);
      }

      .rf-campaign-assignment-v7 .error-banner{
        color:#7c1d1d;
        background:var(--rfca-red-soft);
        border-color:#ffd0cc;
      }

      .rf-campaign-assignment-v7 .success-banner{
        color:#086846;
        background:var(--rfca-green-soft);
        border-color:#caeadb;
      }

      .rf-campaign-assignment-v7 .flex{
        display:flex;
      }

      .rf-campaign-assignment-v7 .flex-between{
        justify-content:space-between;
      }

      .rf-campaign-assignment-v7 .flex-gap{
        gap:7px;
      }

      .rf-campaign-assignment-v7 .btn{
        min-height:37px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 9px;
        color:var(--rfca-text);
        background:#fff;
        border:1px solid var(--rfca-line);
        border-radius:8px;
        cursor:pointer;
        font:700 6.3px/1 Inter,sans-serif;
        transition:.14s var(--rfca-ease);
      }

      .rf-campaign-assignment-v7 .btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rf-campaign-assignment-v7 .btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rf-campaign-assignment-v7 .btn.primary{
        color:#fff;
        background:var(--rfca-primary);
        border-color:var(--rfca-primary);
        box-shadow:0 6px 14px rgba(70,72,212,.12);
      }

      .rf-campaign-assignment-v7 .btn.primary:hover:not(:disabled){
        background:var(--rfca-primary-dark);
      }

      .rf-campaign-assignment-v7 .btn.small{
        min-height:31px;
        padding:5px 7px;
        font-size:5.6px;
      }

      .rf-campaign-assignment-v7 .rf-assignee-picker{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:7px;
      }

      .rf-campaign-assignment-v7 .rf-assignee-picker > label{
        min-width:0;
        min-height:70px;
        display:grid;
        grid-template-columns:15px 36px minmax(0,1fr);
        align-items:center;
        gap:8px;
        padding:9px;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:9px;
        cursor:pointer;
        transition:.13s var(--rfca-ease);
      }

      .rf-campaign-assignment-v7 .rf-assignee-picker > label:hover{
        border-color:#d9daf7;
      }

      .rf-campaign-assignment-v7 .rf-assignee-picker > label.selected{
        background:var(--rfca-primary-soft);
        border-color:#d4d5ff;
      }

      .rf-campaign-assignment-v7 .rf-assignee-picker input{
        width:15px;
        height:15px;
        margin:0;
        accent-color:var(--rfca-primary);
      }

      .rf-campaign-assignment-v7 .rf-assignee-avatar{
        width:36px;
        height:36px;
        display:grid;
        place-items:center;
        overflow:hidden;
        color:#fff;
        background:var(--rfca-primary);
        border-radius:9px;
        font-size:7px;
        font-weight:800;
      }

      .rf-campaign-assignment-v7 .rf-assignee-avatar img{
        width:100%;
        height:100%;
        object-fit:cover;
      }

      .rf-campaign-assignment-v7 .rf-assignee-picker > label > span:last-child{
        min-width:0;
        display:grid;
      }

      .rf-campaign-assignment-v7 .rf-assignee-picker b{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6.4px;
      }

      .rf-campaign-assignment-v7 .rf-assignee-picker small{
        margin-top:2px;
        overflow:hidden;
        color:var(--rfca-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:5.2px;
      }

      .rf-campaign-assignment-v7 .rf-assignment-option{
        min-height:47px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:9px 10px;
        color:var(--rfca-text2);
        background:#f7f8f9;
        border:1px solid var(--rfca-line);
        border-radius:8px;
        font-size:6px;
        line-height:10px;
      }

      .rf-campaign-assignment-v7 .rf-assignment-option input{
        width:15px;
        height:15px;
        flex:0 0 15px;
        margin:0;
        accent-color:var(--rfca-primary);
      }

      .rf-campaign-assignment-v7 .text-muted{
        color:var(--rfca-muted)!important;
        font-size:5.7px;
        line-height:9px;
      }

      .rf-campaign-assignment-v7 .safe-note-v54{
        padding:10px 11px;
        color:var(--rfca-text2);
        background:#f7f8f9;
        border:1px dashed #d7d9dd;
        border-radius:8px;
        font-size:6.2px;
        line-height:10px;
      }

      .rf-campaign-assignment-v7 .safe-note-v54 a{
        color:var(--rfca-primary);
        font-weight:750;
        text-decoration:none;
      }

      .rf-campaign-assignment-v7 .skeleton-list{
        display:grid;
        gap:7px;
      }

      .rf-campaign-assignment-v7 .skeleton-list i{
        height:66px;
        display:block;
        background:linear-gradient(90deg,#eceef0,#f8f9fa,#eceef0);
        background-size:200% 100%;
        border-radius:9px;
      }

      .rf-campaign-assignment-v7 .mb12{
        margin-bottom:0!important;
      }

      .rf-campaign-assignment-v7 .mt16{
        margin-top:0!important;
      }

      @media(max-width:980px){
        .rf-campaign-assignment-v7 .rf-assignee-picker{
          grid-template-columns:1fr 1fr;
        }
      }

      @media(max-width:620px){
        .rf-campaign-assignment-v7 .rf-assignee-picker{
          grid-template-columns:1fr;
        }

        .rf-campaign-assignment-v7 .flex-between{
          align-items:flex-start;
          flex-direction:column;
          gap:7px;
        }

        .rf-campaign-assignment-v7 .flex.mt16{
          align-items:stretch;
          flex-direction:column;
        }

        .rf-campaign-assignment-v7 .flex.mt16 .btn{
          width:100%;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-campaign-assignment-v7,
        .rf-campaign-assignment-v7 *,
        .rf-campaign-assignment-v7 *::before,
        .rf-campaign-assignment-v7 *::after{
          animation:none!important;
          transition-duration:.01ms!important;
        }
      }
    `}</style>
  );
}
