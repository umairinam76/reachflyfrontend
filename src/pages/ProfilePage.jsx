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

  useEffect(() => {
    if (!success) {
      return;
    }

    notifyProfile(
      "success",
      "Profile updated",
      success
    );
  }, [success]);

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
    <main className="rf-profile-page rf-profile-page-v7">
      <ProfilePageV7Styles />
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
      <span>{safeProfileMessage(message)}</span>

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
    <main className="rf-profile-page rf-profile-page-v7">
      <ProfilePageV7Styles />
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

function safeProfileMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/\bWebRTC\b/gi, "browser calling");
}

function notifyProfile(type, title, message) {
  if (typeof window === "undefined") {
    return;
  }

  const bridge = window.reachflyToast;

  if (bridge && typeof bridge[type] === "function") {
    bridge[type](title, message);
    return;
  }

  window.dispatchEvent(
    new CustomEvent("reachfly:toast", {
      detail: {
        type,
        title,
        message,
      },
    })
  );
}

function ProfilePageV7Styles() {
  return (
    <style>{`
      .rf-profile-page-v7{
        --rfp-card:#fff;
        --rfp-soft:#f6f7f8;
        --rfp-text:#191c1d;
        --rfp-text2:#4d4c59;
        --rfp-muted:#777784;
        --rfp-line:#e2e4e7;
        --rfp-primary:#4648d4;
        --rfp-primary-dark:#393bbb;
        --rfp-primary-soft:#e8e9ff;
        --rfp-green:#087a51;
        --rfp-green-soft:#e4f7ee;
        --rfp-red:#ba1a1a;
        --rfp-red-soft:#ffedeb;
        --rfp-amber:#965900;
        --rfp-amber-soft:#fff3d8;
        --rfp-dark:#2e3132;
        --rfp-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 52px;
        color:var(--rfp-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfpPageIn .24s var(--rfp-ease);
      }

      .rf-profile-page-v7 *,
      .rf-profile-page-v7 *::before,
      .rf-profile-page-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfpPageIn{
        from{opacity:0;transform:translateY(5px)}
        to{opacity:1;transform:none}
      }

      @keyframes rfpShimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      .rf-profile-page-v7 .rf-profile-header{
        min-height:138px;
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:18px;
        padding:19px;
        margin-bottom:11px;
        overflow:hidden;
        color:#fff;
        background:
          radial-gradient(circle at 88% 15%,rgba(86,89,223,.25),transparent 32%),
          radial-gradient(circle at 14% 90%,rgba(107,56,212,.16),transparent 29%),
          #2e3132;
        border:1px solid rgba(255,255,255,.06);
        border-radius:14px;
        box-shadow:0 9px 24px rgba(25,28,29,.065);
      }

      .rf-profile-page-v7 .rf-profile-header__identity{
        min-width:0;
        display:grid;
        grid-template-columns:46px minmax(0,1fr);
        align-items:center;
        gap:11px;
      }

      .rf-profile-page-v7 .rf-profile-eyebrow{
        margin:0 0 3px;
        color:#c9caff;
        font-size:5.8px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rf-profile-page-v7 .rf-profile-header h1{
        margin:0;
        color:#fff;
        font:600 28px/35px Geist,Inter,sans-serif;
        letter-spacing:-.03em;
      }

      .rf-profile-page-v7 .rf-profile-header p:not(.rf-profile-eyebrow){
        max-width:720px;
        margin:4px 0 0;
        color:rgba(244,246,247,.62);
        font-size:7px;
        line-height:12px;
      }

      .rf-profile-page-v7 .rf-profile-layout{
        display:grid;
        grid-template-columns:255px minmax(0,1fr);
        align-items:start;
        gap:11px;
      }

      .rf-profile-page-v7 .rf-profile-sidebar{
        position:sticky;
        top:76px;
        min-width:0;
        display:grid;
        gap:9px;
      }

      .rf-profile-page-v7 .rf-profile-identity-card{
        display:grid;
        justify-items:center;
        gap:7px;
        padding:15px;
        background:#fff;
        border:1px solid var(--rfp-line);
        border-radius:11px;
        text-align:center;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-profile-page-v7 .rf-profile-avatar-wrap{
        position:relative;
        width:84px;
        height:84px;
        margin-bottom:2px;
      }

      .rf-profile-page-v7 .rf-profile-avatar{
        width:84px!important;
        height:84px!important;
        display:grid;
        place-items:center;
        overflow:hidden;
        color:#fff;
        background:linear-gradient(135deg,#5658df,#4648d4 60%,#6b38d4);
        border:4px solid #fff;
        border-radius:22px!important;
        box-shadow:0 10px 25px rgba(70,72,212,.14);
        font:700 20px/1 Geist,Inter,sans-serif;
      }

      .rf-profile-page-v7 .rf-profile-avatar img{
        width:100%;
        height:100%;
        object-fit:cover;
      }

      .rf-profile-page-v7 .rf-profile-avatar-actions{
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        gap:5px;
      }

      .rf-profile-page-v7 .rf-profile-avatar-actions button,
      .rf-profile-page-v7 .rf-profile-button{
        min-height:36px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:5px;
        padding:6px 9px;
        color:#fff;
        background:var(--rfp-primary);
        border:1px solid var(--rfp-primary);
        border-radius:8px;
        cursor:pointer;
        font-size:5.8px;
        font-weight:750;
        transition:.14s var(--rfp-ease);
      }

      .rf-profile-page-v7 .rf-profile-avatar-actions button:hover:not(:disabled),
      .rf-profile-page-v7 .rf-profile-button:hover:not(:disabled){
        transform:translateY(-1px);
        background:var(--rfp-primary-dark);
      }

      .rf-profile-page-v7 .rf-profile-avatar-actions button:disabled,
      .rf-profile-page-v7 .rf-profile-button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rf-profile-page-v7 .rf-profile-navigation{
        display:grid;
        gap:4px;
        padding:5px;
        background:#fff;
        border:1px solid var(--rfp-line);
        border-radius:10px;
      }

      .rf-profile-page-v7 .rf-profile-navigation button{
        min-height:38px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:7px;
        padding:7px 9px;
        color:var(--rfp-text2);
        background:transparent;
        border:0;
        border-radius:7px;
        cursor:pointer;
        text-align:left;
        font-size:6.2px;
        font-weight:750;
      }

      .rf-profile-page-v7 .rf-profile-navigation button.is-active,
      .rf-profile-page-v7 .rf-profile-navigation button.active{
        color:var(--rfp-primary);
        background:var(--rfp-primary-soft);
      }

      .rf-profile-page-v7 .rf-profile-content{
        min-width:0;
        display:grid;
        gap:10px;
      }

      .rf-profile-page-v7 .rf-profile-panel{
        min-width:0;
        padding:14px;
        background:#fff;
        border:1px solid var(--rfp-line);
        border-radius:11px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-profile-page-v7 .rf-profile-panel-header{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
        min-height:52px;
        padding-bottom:9px;
        margin-bottom:9px;
        border-bottom:1px solid #eff0f1;
      }

      .rf-profile-page-v7 .rf-profile-panel-header h2,
      .rf-profile-page-v7 .rf-profile-panel-header h3{
        margin:0;
        font:600 14px/19px Geist,Inter,sans-serif;
        letter-spacing:-.015em;
      }

      .rf-profile-page-v7 .rf-profile-panel-header p{
        margin:3px 0 0;
        color:var(--rfp-muted);
        font-size:5.8px;
        line-height:10px;
      }

      .rf-profile-page-v7 .rf-profile-alert{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:9px 10px;
        margin-bottom:9px;
        border:1px solid;
        border-radius:8px;
        font-size:6.3px;
        line-height:10px;
      }

      .rf-profile-page-v7 .rf-profile-alert--success{
        color:#086846;
        background:var(--rfp-green-soft);
        border-color:#caeadb;
      }

      .rf-profile-page-v7 .rf-profile-alert--error{
        color:#7c1d1d;
        background:var(--rfp-red-soft);
        border-color:#ffd0cc;
      }

      .rf-profile-page-v7 .rf-profile-alert button{
        min-height:27px;
        padding:4px 7px;
        color:inherit;
        background:#fff;
        border:1px solid currentColor;
        border-radius:6px;
        cursor:pointer;
        font-size:5.2px;
        font-weight:750;
      }

      .rf-profile-page-v7 .rf-profile-form,
      .rf-profile-page-v7 .rf-security-form{
        display:grid;
        gap:9px;
      }

      .rf-profile-page-v7 .rf-profile-form-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
      }

      .rf-profile-page-v7 .rf-profile-field{
        min-width:0;
        display:grid;
        gap:4px;
      }

      .rf-profile-page-v7 .rf-profile-field--wide{
        grid-column:1/-1;
      }

      .rf-profile-page-v7 .rf-profile-field > span{
        color:var(--rfp-muted);
        font-size:5.5px;
        font-weight:750;
        letter-spacing:.025em;
        text-transform:uppercase;
      }

      .rf-profile-page-v7 input,
      .rf-profile-page-v7 select,
      .rf-profile-page-v7 textarea{
        width:100%;
        min-height:39px;
        padding:8px 9px;
        color:var(--rfp-text);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        outline:0;
        font:400 6.5px/11px Inter,sans-serif;
      }

      .rf-profile-page-v7 textarea{
        min-height:96px;
        resize:vertical;
      }

      .rf-profile-page-v7 input:focus,
      .rf-profile-page-v7 select:focus,
      .rf-profile-page-v7 textarea:focus{
        background:#fff;
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rf-profile-page-v7 .rf-profile-form-footer{
        display:flex;
        justify-content:flex-end;
        gap:7px;
        padding-top:9px;
        border-top:1px solid #eff0f1;
      }

      .rf-profile-page-v7 .rf-availability-options{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:7px;
      }

      .rf-profile-page-v7 .rf-availability-option{
        min-height:84px;
        display:grid;
        grid-template-columns:15px 10px minmax(0,1fr);
        align-items:center;
        gap:7px;
        padding:9px;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:9px;
        cursor:pointer;
      }

      .rf-profile-page-v7 .rf-availability-option.is-selected{
        background:var(--rfp-primary-soft);
        border-color:#d7d8ff;
      }

      .rf-profile-page-v7 .rf-availability-option input{
        width:15px;
        height:15px;
        min-height:0;
        padding:0;
        margin:0;
        accent-color:var(--rfp-primary);
      }

      .rf-profile-page-v7 .rf-availability-option__dot{
        width:9px;
        height:9px;
        background:#a1a2a8;
        border:2px solid #fff;
        border-radius:50%;
      }

      .rf-profile-page-v7 .rf-availability-option--available .rf-availability-option__dot{background:var(--rfp-green)}
      .rf-profile-page-v7 .rf-availability-option--busy .rf-availability-option__dot{background:var(--rfp-red)}
      .rf-profile-page-v7 .rf-availability-option--away .rf-availability-option__dot{background:var(--rfp-amber)}

      .rf-profile-page-v7 .rf-availability-option strong{
        font-size:6.4px;
      }

      .rf-profile-page-v7 .rf-availability-option p{
        margin:2px 0 0;
        color:var(--rfp-muted);
        font-size:5.3px;
        line-height:9px;
      }

      .rf-profile-page-v7 .rf-notification-list{
        display:grid;
        gap:5px;
      }

      .rf-profile-page-v7 .rf-notification-option{
        min-height:62px;
        display:grid;
        grid-template-columns:minmax(0,1fr) 1px 38px;
        align-items:center;
        gap:9px;
        padding:9px;
        background:#f7f8f9;
        border-radius:8px;
        cursor:pointer;
      }

      .rf-profile-page-v7 .rf-notification-option > div{
        min-width:0;
        display:grid;
      }

      .rf-profile-page-v7 .rf-notification-option strong{
        font-size:6.2px;
      }

      .rf-profile-page-v7 .rf-notification-option p{
        margin:2px 0 0;
        color:var(--rfp-muted);
        font-size:5.2px;
        line-height:9px;
      }

      .rf-profile-page-v7 .rf-notification-option input{
        position:absolute;
        opacity:0;
        pointer-events:none;
      }

      .rf-profile-page-v7 .rf-toggle-switch{
        position:relative;
        width:36px;
        height:21px;
        display:block;
        background:#d6d8dc;
        border-radius:999px;
        transition:.14s var(--rfp-ease);
      }

      .rf-profile-page-v7 .rf-toggle-switch i{
        position:absolute;
        top:3px;
        left:3px;
        width:15px;
        height:15px;
        background:#fff;
        border-radius:50%;
        box-shadow:0 1px 4px rgba(25,28,29,.16);
        transition:.14s var(--rfp-ease);
      }

      .rf-profile-page-v7 .rf-notification-option input:checked + .rf-toggle-switch{
        background:var(--rfp-primary);
      }

      .rf-profile-page-v7 .rf-notification-option input:checked + .rf-toggle-switch i{
        transform:translateX(15px);
      }

      .rf-profile-page-v7 .rf-password-requirements{
        display:grid;
        gap:4px;
        padding:9px;
        margin:0;
        background:#f7f8f9;
        border-radius:8px;
        list-style:none;
      }

      .rf-profile-page-v7 .rf-password-requirements li{
        display:flex;
        align-items:center;
        gap:5px;
        color:var(--rfp-muted);
        font-size:5.4px;
      }

      .rf-profile-page-v7 .rf-password-requirements li.is-valid{
        color:var(--rfp-green);
      }

      .rf-profile-page-v7 .rf-password-strength{
        display:grid;
        gap:4px;
        margin-top:4px;
      }

      .rf-profile-page-v7 .rf-password-strength > div{
        display:grid;
        grid-template-columns:repeat(5,1fr);
        gap:3px;
      }

      .rf-profile-page-v7 .rf-password-strength span{
        height:4px;
        background:#e4e5e8;
        border-radius:999px;
      }

      .rf-profile-page-v7 .rf-password-strength span.is-active{
        background:var(--rfp-primary);
      }

      .rf-profile-page-v7 .rf-password-strength small{
        color:var(--rfp-muted);
        font-size:5px;
      }

      .rf-profile-page-v7 .rf-profile-availability-badge{
        display:inline-flex;
        align-items:center;
        width:max-content;
        min-height:24px;
        padding:4px 7px;
        color:var(--rfp-text2);
        background:#f1f2f3;
        border-radius:999px;
        font-size:5.2px;
        font-weight:750;
      }

      .rf-profile-page-v7 .rf-profile-availability-badge--available{
        color:var(--rfp-green);
        background:var(--rfp-green-soft);
      }

      .rf-profile-page-v7 .rf-profile-availability-badge--busy{
        color:var(--rfp-red);
        background:var(--rfp-red-soft);
      }

      .rf-profile-page-v7 .rf-profile-availability-badge--away{
        color:var(--rfp-amber);
        background:var(--rfp-amber-soft);
      }

      .rf-profile-page-v7 .rf-profile-skeleton-header,
      .rf-profile-page-v7 .rf-profile-skeleton-layout > aside,
      .rf-profile-page-v7 .rf-profile-skeleton-layout > div{
        background:linear-gradient(90deg,#eceef0 25%,#f8f9fa 45%,#eceef0 65%);
        background-size:220% 100%;
        border-radius:11px;
        animation:rfpShimmer 1.15s linear infinite;
      }

      .rf-profile-page-v7 .rf-profile-skeleton-header{
        height:138px;
        margin-bottom:11px;
        border-radius:14px;
      }

      .rf-profile-page-v7 .rf-profile-skeleton-layout{
        display:grid;
        grid-template-columns:255px minmax(0,1fr);
        gap:11px;
      }

      .rf-profile-page-v7 .rf-profile-skeleton-layout > aside,
      .rf-profile-page-v7 .rf-profile-skeleton-layout > div{
        min-height:520px;
      }

      @media(max-width:900px){
        .rf-profile-page-v7{
          padding:22px;
        }

        .rf-profile-page-v7 .rf-profile-layout,
        .rf-profile-page-v7 .rf-profile-skeleton-layout{
          grid-template-columns:210px minmax(0,1fr);
        }
      }

      @media(max-width:720px){
        .rf-profile-page-v7 .rf-profile-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rf-profile-page-v7 .rf-profile-layout,
        .rf-profile-page-v7 .rf-profile-skeleton-layout{
          grid-template-columns:1fr;
        }

        .rf-profile-page-v7 .rf-profile-sidebar{
          position:static;
        }

        .rf-profile-page-v7 .rf-profile-navigation{
          display:flex;
          overflow-x:auto;
          scrollbar-width:none;
        }

        .rf-profile-page-v7 .rf-profile-navigation button{
          flex:0 0 auto;
        }
      }

      @media(max-width:620px){
        .rf-profile-page-v7{
          padding:18px 12px 80px;
        }

        .rf-profile-page-v7 .rf-profile-header{
          padding:15px;
        }

        .rf-profile-page-v7 .rf-profile-header h1{
          font-size:23px;
          line-height:30px;
        }

        .rf-profile-page-v7 .rf-profile-form-grid,
        .rf-profile-page-v7 .rf-availability-options{
          grid-template-columns:1fr;
        }

        .rf-profile-page-v7 .rf-profile-field--wide{
          grid-column:auto;
        }

        .rf-profile-page-v7 .rf-profile-form-footer{
          display:grid;
          grid-template-columns:1fr;
        }

        .rf-profile-page-v7 .rf-profile-form-footer .rf-profile-button{
          width:100%;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-profile-page-v7,
        .rf-profile-page-v7 *,
        .rf-profile-page-v7 *::before,
        .rf-profile-page-v7 *::after{
          animation:none!important;
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
