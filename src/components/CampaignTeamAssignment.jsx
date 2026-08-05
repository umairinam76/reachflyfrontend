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

      setMessage(
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
        } using round robin.`
      );

      await onAssigned?.(
        result
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The leads could not be assigned."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!isManager) {
    return null;
  }

  return (
    <section className="cardish rf-campaign-assignment mt24">
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
          Your manager account does not have the
          assign_leads permission. Rerun the AH Growth
          seed and sign in again.
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
