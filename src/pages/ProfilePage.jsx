import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  changeMyPassword,
  getMyProfile,
  onWorkspaceSocket,
  removeProfileAvatar,
  updateMyAvailability,
  updateMyProfile,
  updateNotificationPreferences,
  uploadProfileAvatar,
} from "../lib/workspace-platform-client.js";

import "../styles/profile.css";

const AVAILABILITY_OPTIONS = [
  {
    value: "available",
    label: "Available",
    description:
      "Ready for calls, messages and assignments.",
  },
  {
    value: "busy",
    label: "Busy",
    description:
      "Currently focused or handling active work.",
  },
  {
    value: "away",
    label: "Away",
    description:
      "Temporarily unavailable.",
  },
  {
    value: "offline",
    label: "Offline",
    description:
      "Not currently available for work.",
  },
];

const NOTIFICATION_OPTIONS = [
  {
    key: "chatMessages",
    label: "Team messages",
    description:
      "Receive alerts for messages in internal channels.",
  },
  {
    key: "directMessages",
    label: "Direct messages",
    description:
      "Receive alerts when a teammate messages you directly.",
  },
  {
    key: "groupMessages",
    label: "Group messages",
    description:
      "Receive alerts for messages in private team groups.",
  },
  {
    key: "internalCalls",
    label: "Internal calls",
    description:
      "Receive incoming audio and video call alerts.",
  },
  {
    key: "missedCalls",
    label: "Missed calls",
    description:
      "Receive alerts when an internal call is missed.",
  },
  {
    key: "taskAssignments",
    label: "Task assignments",
    description:
      "Receive alerts when tasks are assigned or updated.",
  },
  {
    key: "attendanceReminders",
    label: "Attendance reminders",
    description:
      "Receive check-in and check-out reminders.",
  },
  {
    key: "leadAssignments",
    label: "Lead assignments",
    description:
      "Receive alerts when new leads are assigned.",
  },
  {
    key: "browserNotifications",
    label: "Browser notifications",
    description:
      "Show ReachFly notifications outside the active browser tab.",
  },
  {
    key: "emailDigest",
    label: "Email digest",
    description:
      "Receive a summary of workspace activity by email.",
  },
];

export default function ProfilePage() {
  const [profile, setProfile] =
    useState(null);

  const [profileForm, setProfileForm] =
    useState(createEmptyProfileForm());

  const [
    notificationPreferences,
    setNotificationPreferences,
  ] = useState(
    createDefaultNotifications()
  );

  const [passwordForm, setPasswordForm] =
    useState({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });

  const [
    availabilityStatus,
    setAvailabilityStatus,
  ] = useState("available");

  const [
    availabilityNote,
    setAvailabilityNote,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [savingProfile, setSavingProfile] =
    useState(false);

  const [
    savingNotifications,
    setSavingNotifications,
  ] = useState(false);

  const [
    savingAvailability,
    setSavingAvailability,
  ] = useState(false);

  const [
    changingPassword,
    setChangingPassword,
  ] = useState(false);

  const [
    uploadingAvatar,
    setUploadingAvatar,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [
    activeSection,
    setActiveSection,
  ] = useState("profile");

  const fileInputRef = useRef(null);

  const loadProfile = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
      }

      setError("");

      try {
        const result =
          await getMyProfile();

        setProfile(result);

        setProfileForm({
          name: result.name || "",
          phone: result.phone || "",
          jobTitle:
            result.jobTitle || "",
          bio: result.bio || "",
          timezone:
            result.timezone || "UTC",
          language:
            result.language || "en",
        });

        setAvailabilityStatus(
          result.availabilityStatus ||
            "available"
        );

        setAvailabilityNote(
          result.availabilityNote || ""
        );

        setNotificationPreferences({
          ...createDefaultNotifications(),
          ...(result.notificationPreferences ||
            {}),
        });
      } catch (requestError) {
        setError(
          requestError?.message ||
            "Your profile could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const unsubscribeProfile =
      onWorkspaceSocket(
        "profile:updated",
        ({ profile: updatedProfile }) => {
          if (
            updatedProfile?.id ===
            profile?.id
          ) {
            setProfile(
              updatedProfile
            );
          }
        }
      );

    const unsubscribeAvailability =
      onWorkspaceSocket(
        "profile:availability-updated",
        (event) => {
          if (
            event?.userId === profile?.id
          ) {
            setAvailabilityStatus(
              event.availabilityStatus ||
                "available"
            );

            setAvailabilityNote(
              event.availabilityNote ||
                ""
            );
          }
        }
      );

    return () => {
      unsubscribeProfile();
      unsubscribeAvailability();
    };
  }, [profile?.id]);

  const roleLabel = useMemo(
    () =>
      formatLabel(
        profile?.workspaceRole ||
          profile?.role ||
          "viewer"
      ),
    [
      profile?.role,
      profile?.workspaceRole,
    ]
  );

  async function saveProfile(event) {
    event.preventDefault();

    setSavingProfile(true);
    setError("");
    setSuccess("");

    try {
      const updated =
        await updateMyProfile({
          name: profileForm.name,
          phone: profileForm.phone,
          jobTitle:
            profileForm.jobTitle,
          bio: profileForm.bio,
          timezone:
            profileForm.timezone,
          language:
            profileForm.language,
        });

      setProfile(updated);

      setSuccess(
        "Your profile was updated successfully."
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Your profile could not be updated."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveAvailability(
    event
  ) {
    event.preventDefault();

    setSavingAvailability(true);
    setError("");
    setSuccess("");

    try {
      const updated =
        await updateMyAvailability(
          availabilityStatus,
          availabilityNote
        );

      setProfile(updated);

      setSuccess(
        "Your availability was updated."
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Your availability could not be updated."
      );
    } finally {
      setSavingAvailability(false);
    }
  }

  async function saveNotifications(
    event
  ) {
    event.preventDefault();

    setSavingNotifications(true);
    setError("");
    setSuccess("");

    try {
      const updated =
        await updateNotificationPreferences(
          notificationPreferences
        );

      setProfile(updated);

      setNotificationPreferences({
        ...createDefaultNotifications(),
        ...(updated.notificationPreferences ||
          {}),
      });

      setSuccess(
        "Your notification preferences were updated."
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Notification preferences could not be updated."
      );
    } finally {
      setSavingNotifications(false);
    }
  }

  async function submitPassword(
    event
  ) {
    event.preventDefault();

    if (
      passwordForm.newPassword !==
      passwordForm.confirmPassword
    ) {
      setError(
        "The new passwords do not match."
      );

      return;
    }

    setChangingPassword(true);
    setError("");
    setSuccess("");

    try {
      await changeMyPassword({
        currentPassword:
          passwordForm.currentPassword,
        newPassword:
          passwordForm.newPassword,
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setSuccess(
        "Your password was changed successfully."
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Your password could not be changed."
      );
    } finally {
      setChangingPassword(false);
    }
  }

  async function selectAvatarFile(
    event
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(file.type)
    ) {
      setError(
        "Select a JPEG, PNG or WebP image."
      );

      return;
    }

    if (
      file.size >
      3 * 1024 * 1024
    ) {
      setError(
        "The profile image must be smaller than 3 MB."
      );

      return;
    }

    setUploadingAvatar(true);
    setError("");
    setSuccess("");

    try {
      const dataUrl =
        await readFileAsDataUrl(file);

      const updated =
        await uploadProfileAvatar(
          dataUrl
        );

      setProfile(updated);

      setSuccess(
        "Your profile picture was updated."
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The profile picture could not be uploaded."
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function deleteAvatar() {
    const confirmed =
      window.confirm(
        "Remove your profile picture?"
      );

    if (!confirmed) {
      return;
    }

    setUploadingAvatar(true);
    setError("");
    setSuccess("");

    try {
      const updated =
        await removeProfileAvatar();

      setProfile(updated);

      setSuccess(
        "Your profile picture was removed."
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The profile picture could not be removed."
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

  function updateProfileField(
    field,
    value
  ) {
    setProfileForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleNotification(
    key
  ) {
    setNotificationPreferences(
      (current) => ({
        ...current,
        [key]: !current[key],
      })
    );
  }

  if (loading) {
    return <ProfileSkeleton />;
  }

  return (
    <main className="rf-profile-page">
      <ProfileHeader
        profile={profile}
        roleLabel={roleLabel}
        availabilityStatus={
          availabilityStatus
        }
      />

      {error ? (
        <ProfileAlert
          type="error"
          message={error}
          onClose={() =>
            setError("")
          }
        />
      ) : null}

      {success ? (
        <ProfileAlert
          type="success"
          message={success}
          onClose={() =>
            setSuccess("")
          }
        />
      ) : null}

      <section className="rf-profile-layout">
        <aside className="rf-profile-sidebar">
          <ProfileIdentityCard
            profile={profile}
            roleLabel={roleLabel}
            uploadingAvatar={
              uploadingAvatar
            }
            fileInputRef={
              fileInputRef
            }
            onSelectAvatar={() =>
              fileInputRef.current?.click()
            }
            onAvatarFileChange={
              selectAvatarFile
            }
            onRemoveAvatar={
              deleteAvatar
            }
          />

          <ProfileNavigation
            activeSection={
              activeSection
            }
            onChange={
              setActiveSection
            }
          />
        </aside>

        <section className="rf-profile-content">
          {activeSection ===
          "profile" ? (
            <PersonalDetailsSection
              profileForm={
                profileForm
              }
              saving={
                savingProfile
              }
              onChange={
                updateProfileField
              }
              onSubmit={
                saveProfile
              }
            />
          ) : null}

          {activeSection ===
          "availability" ? (
            <AvailabilitySection
              status={
                availabilityStatus
              }
              note={
                availabilityNote
              }
              saving={
                savingAvailability
              }
              onStatusChange={
                setAvailabilityStatus
              }
              onNoteChange={
                setAvailabilityNote
              }
              onSubmit={
                saveAvailability
              }
            />
          ) : null}

          {activeSection ===
          "notifications" ? (
            <NotificationsSection
              preferences={
                notificationPreferences
              }
              saving={
                savingNotifications
              }
              onToggle={
                toggleNotification
              }
              onSubmit={
                saveNotifications
              }
            />
          ) : null}

          {activeSection ===
          "security" ? (
            <SecuritySection
              passwordForm={
                passwordForm
              }
              changingPassword={
                changingPassword
              }
              onChange={(
                field,
                value
              ) =>
                setPasswordForm(
                  (current) => ({
                    ...current,
                    [field]:
                      value,
                  })
                )
              }
              onSubmit={
                submitPassword
              }
            />
          ) : null}
        </section>
      </section>
    </main>
  );
}

function ProfileHeader({
  profile,
  roleLabel,
  availabilityStatus,
}) {
  return (
    <header className="rf-profile-header">
      <div>
        <p className="rf-profile-eyebrow">
          Account and preferences
        </p>

        <h1>My profile</h1>

        <p>
          Manage your personal details,
          availability, notifications and
          account security.
        </p>
      </div>

      <div className="rf-profile-header__identity">
        <ProfileAvatar
          profile={profile}
          size="large"
        />

        <div>
          <strong>
            {profile?.name ||
              "Team member"}
          </strong>

          <span>{roleLabel}</span>

          <AvailabilityBadge
            status={
              availabilityStatus
            }
          />
        </div>
      </div>
    </header>
  );
}

function ProfileIdentityCard({
  profile,
  roleLabel,
  uploadingAvatar,
  fileInputRef,
  onSelectAvatar,
  onAvatarFileChange,
  onRemoveAvatar,
}) {
  return (
    <section className="rf-profile-identity-card">
      <div className="rf-profile-avatar-wrap">
        <ProfileAvatar
          profile={profile}
          size="extra-large"
        />

        <button
          type="button"
          onClick={onSelectAvatar}
          disabled={uploadingAvatar}
          title="Update profile picture"
        >
          {uploadingAvatar
            ? "…"
            : "+"}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={
          onAvatarFileChange
        }
      />

      <h2>
        {profile?.name ||
          "Team member"}
      </h2>

      <p>
        {profile?.jobTitle ||
          roleLabel}
      </p>

      <span>
        {profile?.email || ""}
      </span>

      <div className="rf-profile-avatar-actions">
        <button
          type="button"
          onClick={onSelectAvatar}
          disabled={uploadingAvatar}
        >
          Upload picture
        </button>

        {profile?.avatarUrl ? (
          <button
            type="button"
            onClick={onRemoveAvatar}
            disabled={
              uploadingAvatar
            }
          >
            Remove
          </button>
        ) : null}
      </div>

      <small>
        JPEG, PNG or WebP. Maximum
        file size: 3 MB.
      </small>
    </section>
  );
}

function ProfileNavigation({
  activeSection,
  onChange,
}) {
  const items = [
    {
      id: "profile",
      label: "Personal details",
      description:
        "Name, phone and role information.",
    },
    {
      id: "availability",
      label: "Availability",
      description:
        "Set your team presence and status.",
    },
    {
      id: "notifications",
      label: "Notifications",
      description:
        "Choose which alerts you receive.",
    },
    {
      id: "security",
      label: "Security",
      description:
        "Update your account password.",
    },
  ];

  return (
    <nav className="rf-profile-navigation">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={
            activeSection ===
            item.id
              ? "is-active"
              : ""
          }
          onClick={() =>
            onChange(item.id)
          }
        >
          <span>
            {item.label}
          </span>

          <small>
            {item.description}
          </small>
        </button>
      ))}
    </nav>
  );
}

function PersonalDetailsSection({
  profileForm,
  saving,
  onChange,
  onSubmit,
}) {
  return (
    <section className="rf-profile-panel">
      <PanelHeader
        title="Personal details"
        subtitle="Keep your contact details and work information current."
      />

      <form
        className="rf-profile-form"
        onSubmit={onSubmit}
      >
        <div className="rf-profile-form-grid">
          <ProfileField
            label="Full name"
            required
          >
            <input
              value={
                profileForm.name
              }
              onChange={(event) =>
                onChange(
                  "name",
                  event.target.value
                )
              }
              placeholder="Full name"
              maxLength={120}
              required
            />
          </ProfileField>

          <ProfileField label="Phone number">
            <input
              value={
                profileForm.phone
              }
              onChange={(event) =>
                onChange(
                  "phone",
                  event.target.value
                )
              }
              placeholder="+1 555 000 0000"
              maxLength={40}
            />
          </ProfileField>

          <ProfileField label="Job title">
            <input
              value={
                profileForm.jobTitle
              }
              onChange={(event) =>
                onChange(
                  "jobTitle",
                  event.target.value
                )
              }
              placeholder="Cold caller"
              maxLength={120}
            />
          </ProfileField>

          <ProfileField label="Language">
            <select
              value={
                profileForm.language
              }
              onChange={(event) =>
                onChange(
                  "language",
                  event.target.value
                )
              }
            >
              <option value="en">
                English
              </option>

              <option value="es">
                Spanish
              </option>

              <option value="fr">
                French
              </option>

              <option value="de">
                German
              </option>

              <option value="ur">
                Urdu
              </option>

              <option value="ar">
                Arabic
              </option>
            </select>
          </ProfileField>

          <ProfileField
            label="Timezone"
            wide
          >
            <TimezoneSelect
              value={
                profileForm.timezone
              }
              onChange={(value) =>
                onChange(
                  "timezone",
                  value
                )
              }
            />
          </ProfileField>

          <ProfileField
            label="Professional bio"
            wide
          >
            <textarea
              value={
                profileForm.bio
              }
              onChange={(event) =>
                onChange(
                  "bio",
                  event.target.value
                )
              }
              placeholder="Add a short professional description."
              maxLength={1000}
            />

            <small>
              {
                profileForm.bio
                  .length
              }
              /1000
            </small>
          </ProfileField>
        </div>

        <FormFooter>
          <button
            type="submit"
            className="rf-profile-button"
            disabled={
              saving ||
              !profileForm.name.trim()
            }
          >
            {saving
              ? "Saving…"
              : "Save profile"}
          </button>
        </FormFooter>
      </form>
    </section>
  );
}

function AvailabilitySection({
  status,
  note,
  saving,
  onStatusChange,
  onNoteChange,
  onSubmit,
}) {
  return (
    <section className="rf-profile-panel">
      <PanelHeader
        title="Availability"
        subtitle="Let your team know whether you are available for calls, messages and assignments."
      />

      <form onSubmit={onSubmit}>
        <div className="rf-availability-options">
          {AVAILABILITY_OPTIONS.map(
            (option) => (
              <label
                key={option.value}
                className={`rf-availability-option rf-availability-option--${option.value} ${
                  status ===
                  option.value
                    ? "is-selected"
                    : ""
                }`}
              >
                <input
                  type="radio"
                  name="availability"
                  value={
                    option.value
                  }
                  checked={
                    status ===
                    option.value
                  }
                  onChange={() =>
                    onStatusChange(
                      option.value
                    )
                  }
                />

                <span className="rf-availability-option__dot" />

                <div>
                  <strong>
                    {option.label}
                  </strong>

                  <p>
                    {
                      option.description
                    }
                  </p>
                </div>
              </label>
            )
          )}
        </div>

        <ProfileField label="Availability note">
          <textarea
            value={note}
            onChange={(event) =>
              onNoteChange(
                event.target.value
              )
            }
            placeholder="Optional message for your team."
            maxLength={240}
          />

          <small>
            {note.length}/240
          </small>
        </ProfileField>

        <FormFooter>
          <button
            type="submit"
            className="rf-profile-button"
            disabled={saving}
          >
            {saving
              ? "Updating…"
              : "Update availability"}
          </button>
        </FormFooter>
      </form>
    </section>
  );
}

function NotificationsSection({
  preferences,
  saving,
  onToggle,
  onSubmit,
}) {
  return (
    <section className="rf-profile-panel">
      <PanelHeader
        title="Notification preferences"
        subtitle="Control how ReachFly notifies you about team activity and assigned work."
      />

      <form onSubmit={onSubmit}>
        <div className="rf-notification-list">
          {NOTIFICATION_OPTIONS.map(
            (option) => (
              <NotificationOption
                key={option.key}
                option={option}
                enabled={Boolean(
                  preferences[
                    option.key
                  ]
                )}
                onToggle={() =>
                  onToggle(
                    option.key
                  )
                }
              />
            )
          )}
        </div>

        <FormFooter>
          <button
            type="submit"
            className="rf-profile-button"
            disabled={saving}
          >
            {saving
              ? "Saving…"
              : "Save preferences"}
          </button>
        </FormFooter>
      </form>
    </section>
  );
}

function NotificationOption({
  option,
  enabled,
  onToggle,
}) {
  return (
    <label className="rf-notification-option">
      <div>
        <strong>
          {option.label}
        </strong>

        <p>
          {option.description}
        </p>
      </div>

      <input
        type="checkbox"
        checked={enabled}
        onChange={onToggle}
      />

      <span className="rf-toggle-switch">
        <i />
      </span>
    </label>
  );
}

function SecuritySection({
  passwordForm,
  changingPassword,
  onChange,
  onSubmit,
}) {
  const passwordScore =
    calculatePasswordStrength(
      passwordForm.newPassword
    );

  return (
    <section className="rf-profile-panel">
      <PanelHeader
        title="Account security"
        subtitle="Choose a strong password that is not used for another service."
      />

      <form
        className="rf-security-form"
        onSubmit={onSubmit}
      >
        <ProfileField
          label="Current password"
          wide
        >
          <input
            type="password"
            value={
              passwordForm.currentPassword
            }
            onChange={(event) =>
              onChange(
                "currentPassword",
                event.target.value
              )
            }
            autoComplete="current-password"
            required
          />
        </ProfileField>

        <ProfileField
          label="New password"
          wide
        >
          <input
            type="password"
            value={
              passwordForm.newPassword
            }
            onChange={(event) =>
              onChange(
                "newPassword",
                event.target.value
              )
            }
            autoComplete="new-password"
            required
          />

          <PasswordStrength
            score={passwordScore}
          />
        </ProfileField>

        <ProfileField
          label="Confirm new password"
          wide
        >
          <input
            type="password"
            value={
              passwordForm.confirmPassword
            }
            onChange={(event) =>
              onChange(
                "confirmPassword",
                event.target.value
              )
            }
            autoComplete="new-password"
            required
          />
        </ProfileField>

        <div className="rf-password-requirements">
          <strong>
            Password requirements
          </strong>

          <ul>
            <PasswordRequirement
              valid={
                passwordForm
                  .newPassword
                  .length >= 10
              }
              label="At least 10 characters"
            />

            <PasswordRequirement
              valid={/[A-Z]/.test(
                passwordForm.newPassword
              )}
              label="One uppercase letter"
            />

            <PasswordRequirement
              valid={/[a-z]/.test(
                passwordForm.newPassword
              )}
              label="One lowercase letter"
            />

            <PasswordRequirement
              valid={/\d/.test(
                passwordForm.newPassword
              )}
              label="One number"
            />

            <PasswordRequirement
              valid={/[^A-Za-z0-9]/.test(
                passwordForm.newPassword
              )}
              label="One special character"
            />
          </ul>
        </div>

        <FormFooter>
          <button
            type="submit"
            className="rf-profile-button"
            disabled={
              changingPassword ||
              !passwordForm.currentPassword ||
              !passwordForm.newPassword ||
              !passwordForm.confirmPassword
            }
          >
            {changingPassword
              ? "Changing password…"
              : "Change password"}
          </button>
        </FormFooter>
      </form>
    </section>
  );
}

function PasswordStrength({
  score,
}) {
  const labels = [
    "Very weak",
    "Weak",
    "Fair",
    "Good",
    "Strong",
  ];

  return (
    <div className="rf-password-strength">
      <div>
        {Array.from({
          length: 5,
        }).map((_, index) => (
          <span
            key={index}
            className={
              index < score
                ? "is-active"
                : ""
            }
          />
        ))}
      </div>

      <small>
        {labels[
          Math.max(
            0,
            Math.min(
              score - 1,
              labels.length - 1
            )
          )
        ] || "Very weak"}
      </small>
    </div>
  );
}

function PasswordRequirement({
  valid,
  label,
}) {
  return (
    <li
      className={
        valid ? "is-valid" : ""
      }
    >
      <span>
        {valid ? "✓" : "○"}
      </span>

      {label}
    </li>
  );
}

function ProfileField({
  label,
  required = false,
  wide = false,
  children,
}) {
  return (
    <label
      className={`rf-profile-field ${
        wide
          ? "rf-profile-field--wide"
          : ""
      }`}
    >
      <span>
        {label}

        {required ? (
          <b> *</b>
        ) : null}
      </span>

      {children}
    </label>
  );
}

function TimezoneSelect({
  value,
  onChange,
}) {
  const timezoneOptions =
    useMemo(() => {
      const supported =
        typeof Intl.supportedValuesOf ===
        "function"
          ? Intl.supportedValuesOf(
              "timeZone"
            )
          : [
              "UTC",
              "America/Los_Angeles",
              "America/Denver",
              "America/Chicago",
              "America/New_York",
              "Europe/London",
              "Europe/Paris",
              "Asia/Dubai",
              "Asia/Karachi",
              "Asia/Kolkata",
              "Asia/Singapore",
              "Australia/Sydney",
            ];

      return [
        ...new Set([
          value || "UTC",
          "UTC",
          ...supported,
        ]),
      ];
    }, [value]);

  return (
    <select
      value={value}
      onChange={(event) =>
        onChange(
          event.target.value
        )
      }
    >
      {timezoneOptions.map(
        (timezone) => (
          <option
            key={timezone}
            value={timezone}
          >
            {timezone}
          </option>
        )
      )}
    </select>
  );
}

function PanelHeader({
  title,
  subtitle,
}) {
  return (
    <header className="rf-profile-panel-header">
      <h2>{title}</h2>

      <p>{subtitle}</p>
    </header>
  );
}

function FormFooter({
  children,
}) {
  return (
    <footer className="rf-profile-form-footer">
      {children}
    </footer>
  );
}

function ProfileAvatar({
  profile = {},
  size = "normal",
}) {
  const [failed, setFailed] =
    useState(false);

  return (
    <span
      className={`rf-profile-avatar rf-profile-avatar--${size}`}
    >
      {profile.avatarUrl &&
      !failed ? (
        <img
          src={profile.avatarUrl}
          alt={
            profile.name ||
            "Team member"
          }
          onError={() =>
            setFailed(true)
          }
        />
      ) : (
        <b>
          {getInitials(
            profile.name ||
              profile.email ||
              "RF"
          )}
        </b>
      )}
    </span>
  );
}

function AvailabilityBadge({
  status,
}) {
  const option =
    AVAILABILITY_OPTIONS.find(
      (item) =>
        item.value === status
    );

  return (
    <span
      className={`rf-profile-availability-badge rf-profile-availability-badge--${status}`}
    >
      {option?.label ||
        formatLabel(status)}
    </span>
  );
}

function ProfileAlert({
  type,
  message,
  onClose,
}) {
  return (
    <div
      className={`rf-profile-alert rf-profile-alert--${type}`}
    >
      <span>{message}</span>

      <button
        type="button"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <main className="rf-profile-page">
      <div className="rf-profile-skeleton-header" />

      <section className="rf-profile-skeleton-layout">
        <aside />

        <div />
      </section>
    </main>
  );
}

function createEmptyProfileForm() {
  return {
    name: "",
    phone: "",
    jobTitle: "",
    bio: "",
    timezone: "UTC",
    language: "en",
  };
}

function createDefaultNotifications() {
  return {
    chatMessages: true,
    directMessages: true,
    groupMessages: true,
    internalCalls: true,
    missedCalls: true,
    taskAssignments: true,
    attendanceReminders: true,
    leadAssignments: true,
    browserNotifications: true,
    emailDigest: false,
  };
}

function calculatePasswordStrength(
  password
) {
  let score = 0;

  if (password.length >= 10) {
    score += 1;
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  }

  if (/[a-z]/.test(password)) {
    score += 1;
  }

  if (/\d/.test(password)) {
    score += 1;
  }

  if (
    /[^A-Za-z0-9]/.test(
      password
    )
  ) {
    score += 1;
  }

  return score;
}

function readFileAsDataUrl(file) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () =>
        resolve(
          String(
            reader.result || ""
          )
        );

      reader.onerror = () =>
        reject(
          new Error(
            "The selected file could not be read."
          )
        );

      reader.readAsDataURL(file);
    }
  );
}

function getInitials(value) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "RF";
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${words[0][0]}${
    words[words.length - 1][0]
  }`.toUpperCase();
}

function formatLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}