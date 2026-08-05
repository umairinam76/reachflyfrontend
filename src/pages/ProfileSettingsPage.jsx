// apps/web/src/pages/ProfileSettingsPage.jsx

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  apiRequest,
  onWorkspaceSocket,
  uploadFile,
} from "../lib/workspace-platform-client.js";

import { useAuth } from "../auth/AuthContext";

import "../styles.css";

const PROFILE_SECTIONS = [
  {
    id: "profile",
    label: "Profile",
    description: "Personal information and profile picture",
  },
  {
    id: "work",
    label: "Work preferences",
    description: "Timezone, availability and working hours",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Email, browser and workspace alerts",
  },
  {
    id: "calling",
    label: "Calling",
    description: "Dialer and call workspace preferences",
  },
  {
    id: "email",
    label: "Email",
    description: "Sender identity and email signature",
  },
  {
    id: "security",
    label: "Security",
    description: "Password and active sessions",
  },
];

const TIMEZONE_OPTIONS = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const LANGUAGE_OPTIONS = [
  {
    value: "en",
    label: "English",
  },
  {
    value: "es",
    label: "Spanish",
  },
  {
    value: "fr",
    label: "French",
  },
  {
    value: "de",
    label: "German",
  },
  {
    value: "pt",
    label: "Portuguese",
  },
];

const AVAILABILITY_OPTIONS = [
  {
    value: "available",
    label: "Available",
  },
  {
    value: "busy",
    label: "Busy",
  },
  {
    value: "away",
    label: "Away",
  },
  {
    value: "offline",
    label: "Offline",
  },
];

const THEME_OPTIONS = [
  {
    value: "system",
    label: "Use system preference",
  },
  {
    value: "light",
    label: "Light",
  },
  {
    value: "dark",
    label: "Dark",
  },
];

const WEEK_DAYS = [
  {
    id: "monday",
    label: "Monday",
  },
  {
    id: "tuesday",
    label: "Tuesday",
  },
  {
    id: "wednesday",
    label: "Wednesday",
  },
  {
    id: "thursday",
    label: "Thursday",
  },
  {
    id: "friday",
    label: "Friday",
  },
  {
    id: "saturday",
    label: "Saturday",
  },
  {
    id: "sunday",
    label: "Sunday",
  },
];

const DEFAULT_WORKING_HOURS = WEEK_DAYS.reduce(
  (output, day, index) => ({
    ...output,
    [day.id]: {
      enabled: index < 5,
      start: "09:00",
      end: "17:00",
    },
  }),
  {}
);

const DEFAULT_NOTIFICATION_SETTINGS = {
  assignmentCreated: true,
  assignmentUpdated: true,
  taskCreated: true,
  taskUpdated: true,
  chatMessages: true,
  mentions: true,
  callUpdates: true,
  auditCompleted: true,
  attendanceReminders: true,
  emailNotifications: true,
  browserNotifications: true,
  soundEnabled: true,
};

const DEFAULT_CALL_SETTINGS = {
  autoOpenMiniAudit: true,
  autoStartCallTimer: true,
  confirmBeforeCalling: false,
  enableCallSounds: true,
  showCallScript: true,
  defaultSpeakerEnabled: true,
  defaultMicrophoneEnabled: true,
  preferredDialerId: "",
};

const DEFAULT_EMAIL_SETTINGS = {
  preferredSenderId: "",
  signature: "",
  includeSignature: true,
  trackOpens: true,
  trackClicks: true,
};

export default function ProfileSettingsPage() {
  const { updateUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [dialers, setDialers] = useState([]);
  const [senders, setSenders] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [activeSection, setActiveSection] = useState("profile");

  const [profileForm, setProfileForm] = useState(
    createEmptyProfileForm()
  );

  const [workForm, setWorkForm] = useState(
    createEmptyWorkForm()
  );

  const [notificationForm, setNotificationForm] = useState(
    DEFAULT_NOTIFICATION_SETTINGS
  );

  const [callForm, setCallForm] = useState(
    DEFAULT_CALL_SETTINGS
  );

  const [emailForm, setEmailForm] = useState(
    DEFAULT_EMAIL_SETTINGS
  );

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingWork, setSavingWork] = useState(false);
  const [savingNotifications, setSavingNotifications] =
    useState(false);
  const [savingCalling, setSavingCalling] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  const [terminatingSessionId, setTerminatingSessionId] =
    useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const avatarInputRef = useRef(null);

  const loadSettings = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const results = await Promise.allSettled([
          apiRequest("/profile/me"),
          apiRequest("/profile/preferences"),
          apiRequest("/profile/sessions"),
        apiRequest("/dialers"),
apiRequest("/senders"),
        ]);

        const profileResponse = getSettledValue(results[0], {});
        const preferencesResponse = getSettledValue(results[1], {});
        const sessionsResponse = getSettledValue(results[2], {});
        const dialersResponse = getSettledValue(results[3], {});
        const sendersResponse = getSettledValue(results[4], {});

        const currentProfile =
          profileResponse.profile ||
          profileResponse.user ||
          profileResponse;

        const preferences =
          preferencesResponse.preferences ||
          currentProfile.preferences ||
          {};

        setProfile(currentProfile);

        setProfileForm({
          name: currentProfile.name || "",
          firstName:
            currentProfile.firstName ||
            getFirstName(currentProfile.name),
          lastName:
            currentProfile.lastName ||
            getLastName(currentProfile.name),
          jobTitle: currentProfile.jobTitle || "",
          department: currentProfile.department || "",
          phone: currentProfile.phone || "",
          email: currentProfile.email || "",
          bio: currentProfile.bio || "",
        });

        setWorkForm({
          timezone:
            preferences.timezone ||
            currentProfile.timezone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone ||
            "UTC",
          language:
            preferences.language ||
            currentProfile.language ||
            "en",
          theme:
            preferences.theme ||
            currentProfile.theme ||
            "system",
          availabilityStatus:
            currentProfile.availabilityStatus ||
            preferences.availabilityStatus ||
            "offline",
          workingHours: normalizeWorkingHours(
            preferences.workingHours ||
              currentProfile.workingHours ||
              DEFAULT_WORKING_HOURS
          ),
        });

        setNotificationForm({
          ...DEFAULT_NOTIFICATION_SETTINGS,
          ...(preferences.notifications ||
            currentProfile.notificationPreferences ||
            {}),
        });

        setCallForm({
          ...DEFAULT_CALL_SETTINGS,
          ...(preferences.calling ||
            currentProfile.callPreferences ||
            {}),
          preferredDialerId:
            preferences.calling?.preferredDialerId ||
            currentProfile.preferredDialerId ||
            currentProfile.assignedDialerId ||
            "",
        });

        setEmailForm({
          ...DEFAULT_EMAIL_SETTINGS,
          ...(preferences.email ||
            currentProfile.emailPreferences ||
            {}),
          preferredSenderId:
            preferences.email?.preferredSenderId ||
            currentProfile.preferredSenderId ||
            currentProfile.assignedSenderId ||
            "",
          signature:
            preferences.email?.signature ||
            currentProfile.emailSignature ||
            "",
        });

        setSessions(
          sessionsResponse.sessions ||
            sessionsResponse.records ||
            []
        );

        setDialers(
          dialersResponse.dialers ||
            dialersResponse.records ||
            []
        );

        setSenders(
          sendersResponse.senders ||
            sendersResponse.records ||
            []
        );
      } catch (requestError) {
        setError(
          requestError?.message ||
            "Your profile settings could not be loaded."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const unsubscribe = [
      onWorkspaceSocket("profile:updated", (event) => {
        const updatedProfile = event.profile || event.user || event;

        if (
          profile?.id &&
          updatedProfile?.id &&
          profile.id !== updatedProfile.id
        ) {
          return;
        }

        setProfile((current) => ({
          ...(current || {}),
          ...updatedProfile,
        }));
      }),

      onWorkspaceSocket("profile:avatar-updated", (event) => {
        if (
          event?.userId &&
          profile?.id &&
          event.userId !== profile.id
        ) {
          return;
        }

        const avatarUrl =
          event.avatarUrl ||
          event.profile?.avatarUrl ||
          "";

        setProfile((current) => ({
          ...(current || {}),
          avatarUrl,
        }));
      }),

      onWorkspaceSocket("team:tools-updated", () => {
        loadSettings({
          silent: true,
        });
      }),
    ];

    return () => {
      unsubscribe.forEach((stop) => stop());
    };
  }, [loadSettings, profile?.id]);

  const role = normalizeRole(
    profile?.workspaceRole ||
      profile?.role
  );

  const canConfigureSender =
    role === "owner" ||
    role === "admin" ||
    role === "manager";

  const visibleSections = useMemo(
    () =>
      PROFILE_SECTIONS.filter((section) => {
        if (
          section.id === "email" &&
          !profile?.email
        ) {
          return false;
        }

        return true;
      }),
    [profile?.email]
  );

  async function saveProfile(event) {
    event.preventDefault();

    setSavingProfile(true);
    setError("");
    setSuccess("");

    try {
      const name =
        `${profileForm.firstName} ${profileForm.lastName}`.trim();

      const response = await apiRequest("/profile/me", {
        method: "PATCH",
        body: {
          name,
          firstName: profileForm.firstName.trim(),
          lastName: profileForm.lastName.trim(),
          jobTitle: profileForm.jobTitle.trim(),
          department: profileForm.department.trim(),
          phone: profileForm.phone.trim(),
          bio: profileForm.bio.trim(),
        },
      });

      const updated =
        response.profile ||
        response.user ||
        response;

      setProfile((current) => ({
        ...(current || {}),
        ...updated,
      }));

      setSuccess("Your profile information was updated.");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Your profile information could not be saved."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveWorkPreferences(event) {
    event.preventDefault();

    setSavingWork(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest("/profile/preferences", {
        method: "PATCH",
        body: {
          timezone: workForm.timezone,
          language: workForm.language,
          theme: workForm.theme,
          availabilityStatus: workForm.availabilityStatus,
          workingHours: workForm.workingHours,
        },
      });

      const preferences =
        response.preferences ||
        response;

      setProfile((current) => ({
        ...(current || {}),
        timezone: workForm.timezone,
        language: workForm.language,
        theme: workForm.theme,
        availabilityStatus: workForm.availabilityStatus,
        workingHours: workForm.workingHours,
        preferences: {
          ...(current?.preferences || {}),
          ...preferences,
        },
      }));

      applyTheme(workForm.theme);

      setSuccess("Your work preferences were updated.");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Your work preferences could not be saved."
      );
    } finally {
      setSavingWork(false);
    }
  }

  async function saveNotificationPreferences(event) {
    event.preventDefault();

    setSavingNotifications(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest("/profile/preferences", {
        method: "PATCH",
        body: {
          notifications: notificationForm,
        },
      });

      setProfile((current) => ({
        ...(current || {}),
        notificationPreferences: notificationForm,
        preferences: {
          ...(current?.preferences || {}),
          notifications: notificationForm,
        },
      }));

      if (
        notificationForm.browserNotifications &&
        "Notification" in window &&
        Notification.permission === "default"
      ) {
        await Notification.requestPermission();
      }

      setSuccess("Your notification preferences were updated.");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Your notification preferences could not be saved."
      );
    } finally {
      setSavingNotifications(false);
    }
  }

  async function saveCallingPreferences(event) {
    event.preventDefault();

    setSavingCalling(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest("/profile/preferences", {
        method: "PATCH",
        body: {
          calling: callForm,
        },
      });

      setProfile((current) => ({
        ...(current || {}),
        preferredDialerId: callForm.preferredDialerId,
        callPreferences: callForm,
        preferences: {
          ...(current?.preferences || {}),
          calling: callForm,
        },
      }));

      setSuccess("Your calling preferences were updated.");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Your calling preferences could not be saved."
      );
    } finally {
      setSavingCalling(false);
    }
  }

  async function saveEmailPreferences(event) {
    event.preventDefault();

    setSavingEmail(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest("/profile/preferences", {
        method: "PATCH",
        body: {
          email: emailForm,
        },
      });

      setProfile((current) => ({
        ...(current || {}),
        preferredSenderId: emailForm.preferredSenderId,
        emailSignature: emailForm.signature,
        emailPreferences: emailForm,
        preferences: {
          ...(current?.preferences || {}),
          email: emailForm,
        },
      }));

      setSuccess("Your email preferences were updated.");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Your email preferences could not be saved."
      );
    } finally {
      setSavingEmail(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !passwordForm.currentPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      setError("Complete all password fields.");
      return;
    }

    if (passwordForm.newPassword.length < 10) {
      setError("The new password must contain at least 10 characters.");
      return;
    }

    if (
      passwordForm.newPassword !==
      passwordForm.confirmPassword
    ) {
      setError("The new password confirmation does not match.");
      return;
    }

    setSavingPassword(true);

    try {
      await apiRequest("/profile/password", {
        method: "PATCH",
        body: {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setSuccess("Your password was changed successfully.");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Your password could not be changed."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  async function uploadAvatar(event) {
    const input = event.currentTarget;
    const file = input.files?.[0] || null;

    input.value = "";

    if (!file) {
      return;
    }

    const allowedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);

    if (!allowedTypes.has(file.type)) {
      setError(
        "Select a JPG, PNG, WebP, or GIF image."
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(
        "The profile image must be smaller than 5 MB."
      );
      return;
    }

    setUploadingAvatar(true);
    setError("");
    setSuccess("");

    try {
      const response = await uploadFile(
        "/profile/avatar",
        {
          file,
          fieldName: "avatar",
        }
      );

      const updatedProfile =
        response?.profile ||
        response?.user ||
        {};

      const avatarUrl =
        response?.avatarUrl ||
        updatedProfile?.avatarUrl ||
        updatedProfile?.photoUrl ||
        updatedProfile?.profileImage ||
        "";

      const nextProfile = {
        ...(profile || {}),
        ...updatedProfile,
        avatarUrl,
        photoUrl:
          updatedProfile?.photoUrl ||
          avatarUrl,
        profileImage:
          updatedProfile?.profileImage ||
          avatarUrl,
      };

      setProfile(nextProfile);

      updateUser((currentUser) => ({
        ...(currentUser || {}),
        ...nextProfile,
      }));

      setSuccess(
        "Your profile picture was updated."
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Your profile picture could not be uploaded."
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function removeAvatar() {
    if (!profile?.avatarUrl) {
      return;
    }

    setRemovingAvatar(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest("/profile/avatar", {
        method: "DELETE",
      });

      setProfile((current) => ({
        ...(current || {}),
        avatarUrl: "",
        photoUrl: "",
        profileImage: "",
      }));

      updateUser((currentUser) => ({
        ...(currentUser || {}),
        avatarUrl: "",
        photoUrl: "",
        profileImage: "",
      }));

      setSuccess("Your profile picture was removed.");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Your profile picture could not be removed."
      );
    } finally {
      setRemovingAvatar(false);
    }
  }

  async function terminateSession(sessionId) {
    setTerminatingSessionId(sessionId);
    setError("");
    setSuccess("");

    try {
      await apiRequest(
        `/profile/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: "DELETE",
        }
      );

      setSessions((current) =>
        current.filter((session) => session.id !== sessionId)
      );

      setSuccess("The selected session was signed out.");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The selected session could not be terminated."
      );
    } finally {
      setTerminatingSessionId("");
    }
  }

  async function terminateOtherSessions() {
    setTerminatingSessionId("all");
    setError("");
    setSuccess("");

    try {
      await apiRequest("/profile/sessions/others", {
        method: "DELETE",
      });

      setSessions((current) =>
        current.filter(
          (session) =>
            session.current ||
            session.isCurrent
        )
      );

      setSuccess("All other sessions were signed out.");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Other sessions could not be terminated."
      );
    } finally {
      setTerminatingSessionId("");
    }
  }

  if (loading) {
    return <ProfileSettingsSkeleton />;
  }

  return (
    <main className="rf-role-dashboard">
      <ProfileHeader
        profile={profile}
        refreshing={refreshing}
        onRefresh={() =>
          loadSettings({
            silent: true,
          })
        }
      />

      {error ? (
        <SettingsAlert
          type="error"
          message={error}
          onClose={() => setError("")}
        />
      ) : null}

      {success ? (
        <SettingsAlert
          type="success"
          message={success}
          onClose={() => setSuccess("")}
        />
      ) : null}

      <section className="rf-settings-layout">
        <aside className="rf-settings-navigation-panel">
          <ProfileSummary
            profile={profile}
            uploadingAvatar={uploadingAvatar}
            removingAvatar={removingAvatar}
            avatarInputRef={avatarInputRef}
            onUploadAvatar={uploadAvatar}
            onRemoveAvatar={removeAvatar}
          />

          <nav className="rf-settings-navigation">
            {visibleSections.map((section) => (
              <button
                type="button"
                key={section.id}
                className={
                  activeSection === section.id
                    ? "is-active"
                    : ""
                }
                onClick={() =>
                  setActiveSection(section.id)
                }
              >
                <span>
                  {sectionIcon(section.id)}
                </span>

                <div>
                  <strong>{section.label}</strong>
                  <small>{section.description}</small>
                </div>
              </button>
            ))}
          </nav>
        </aside>

        <div className="rf-settings-content">
          {activeSection === "profile" ? (
            <ProfileInformationSection
              profile={profile}
              form={profileForm}
              saving={savingProfile}
              onChange={(field, value) =>
                updateForm(
                  setProfileForm,
                  field,
                  value
                )
              }
              onSubmit={saveProfile}
            />
          ) : null}

          {activeSection === "work" ? (
            <WorkPreferencesSection
              form={workForm}
              saving={savingWork}
              onChange={(field, value) =>
                updateForm(
                  setWorkForm,
                  field,
                  value
                )
              }
              onWorkingHoursChange={(
                day,
                field,
                value
              ) => {
                setWorkForm((current) => ({
                  ...current,
                  workingHours: {
                    ...current.workingHours,
                    [day]: {
                      ...current.workingHours[day],
                      [field]: value,
                    },
                  },
                }));
              }}
              onSubmit={saveWorkPreferences}
            />
          ) : null}

          {activeSection === "notifications" ? (
            <NotificationPreferencesSection
              form={notificationForm}
              saving={savingNotifications}
              onChange={(field, value) =>
                updateForm(
                  setNotificationForm,
                  field,
                  value
                )
              }
              onSubmit={saveNotificationPreferences}
            />
          ) : null}

          {activeSection === "calling" ? (
            <CallingPreferencesSection
              form={callForm}
              dialers={dialers}
              profile={profile}
              saving={savingCalling}
              onChange={(field, value) =>
                updateForm(
                  setCallForm,
                  field,
                  value
                )
              }
              onSubmit={saveCallingPreferences}
            />
          ) : null}

          {activeSection === "email" ? (
            <EmailPreferencesSection
              form={emailForm}
              senders={senders}
              profile={profile}
              canConfigureSender={canConfigureSender}
              saving={savingEmail}
              onChange={(field, value) =>
                updateForm(
                  setEmailForm,
                  field,
                  value
                )
              }
              onSubmit={saveEmailPreferences}
            />
          ) : null}

          {activeSection === "security" ? (
            <SecuritySection
              profile={profile}
              passwordForm={passwordForm}
              sessions={sessions}
              savingPassword={savingPassword}
              terminatingSessionId={terminatingSessionId}
              onPasswordChange={(field, value) =>
                updateForm(
                  setPasswordForm,
                  field,
                  value
                )
              }
              onChangePassword={changePassword}
              onTerminateSession={terminateSession}
              onTerminateOtherSessions={terminateOtherSessions}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function ProfileHeader({
  profile,
  refreshing,
  onRefresh,
}) {
  return (
    <header className="rf-dashboard-header">
      <div className="rf-dashboard-header__identity">
        <ProfileAvatar
          profile={profile}
          large
        />

        <div>
          <p className="rf-dashboard-eyebrow">
            Account preferences
          </p>

          <h1>Profile settings</h1>

          <p className="rf-dashboard-subtitle">
            Manage your personal information, working preferences,
            notifications, call configuration and account security.
          </p>
        </div>
      </div>

      <div className="rf-dashboard-header__actions">
        <div className="rf-server-status">
          <span className="rf-status-dot" />

          <div>
            <strong>Profile synchronized</strong>

            <small>
              Changes apply across your workspace
            </small>
          </div>
        </div>

        <button
          type="button"
          className="rf-button rf-button--secondary"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing
            ? "Refreshing…"
            : "Refresh settings"}
        </button>
      </div>
    </header>
  );
}

function ProfileSummary({
  profile,
  uploadingAvatar,
  removingAvatar,
  avatarInputRef,
  onUploadAvatar,
  onRemoveAvatar,
}) {
  return (
    <section className="rf-settings-profile-summary">
      <ProfileAvatar
        profile={profile}
        extraLarge
      />

      <h2>
        {profile?.name ||
          "Team member"}
      </h2>

      <p>
        {profile?.jobTitle ||
          formatLabel(
            profile?.workspaceRole ||
              profile?.role ||
              "member"
          )}
      </p>

      <span>
        {profile?.email}
      </span>

      <StatusBadge
        value={
          profile?.availabilityStatus ||
          "offline"
        }
      />

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={onUploadAvatar}
      />

      <div className="rf-settings-avatar-actions">
        <button
          type="button"
          className="rf-button rf-button--secondary rf-button--compact"
          onClick={() =>
            avatarInputRef.current?.click()
          }
          disabled={uploadingAvatar}
        >
          {uploadingAvatar
            ? "Uploading…"
            : "Change picture"}
        </button>

        {profile?.avatarUrl ? (
          <button
            type="button"
            className="rf-settings-danger-link"
            onClick={onRemoveAvatar}
            disabled={removingAvatar}
          >
            {removingAvatar
              ? "Removing…"
              : "Remove"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ProfileInformationSection({
  profile,
  form,
  saving,
  onChange,
  onSubmit,
}) {
  return (
    <SettingsPanel
      title="Personal information"
      subtitle="Keep your team profile and caller identity current."
    >
      <form onSubmit={onSubmit}>
        <div className="rf-settings-form-grid">
          <SettingsField
            label="First name"
            required
          >
            <input
              value={form.firstName}
              onChange={(event) =>
                onChange(
                  "firstName",
                  event.target.value
                )
              }
              required
              autoComplete="given-name"
            />
          </SettingsField>

          <SettingsField
            label="Last name"
            required
          >
            <input
              value={form.lastName}
              onChange={(event) =>
                onChange(
                  "lastName",
                  event.target.value
                )
              }
              required
              autoComplete="family-name"
            />
          </SettingsField>

          <SettingsField label="Email address">
            <input
              value={form.email}
              disabled
              type="email"
            />

            <small>
              Your login email is managed by the workspace.
            </small>
          </SettingsField>

          <SettingsField label="Phone number">
            <input
              value={form.phone}
              onChange={(event) =>
                onChange(
                  "phone",
                  event.target.value
                )
              }
              type="tel"
              autoComplete="tel"
              placeholder="+1 555 000 0000"
            />
          </SettingsField>

          <SettingsField label="Job title">
            <input
              value={form.jobTitle}
              onChange={(event) =>
                onChange(
                  "jobTitle",
                  event.target.value
                )
              }
              placeholder="Cold Caller"
            />
          </SettingsField>

          <SettingsField label="Department">
            <input
              value={form.department}
              onChange={(event) =>
                onChange(
                  "department",
                  event.target.value
                )
              }
              placeholder="Sales"
            />
          </SettingsField>

          <SettingsField
            label="Workspace role"
          >
            <input
              value={formatLabel(
                profile?.workspaceRole ||
                  profile?.role ||
                  "member"
              )}
              disabled
            />

            <small>
              Workspace roles can be changed by an owner or administrator.
            </small>
          </SettingsField>

          <SettingsField
            label="Member since"
          >
            <input
              value={formatDate(
                profile?.createdAt
              )}
              disabled
            />
          </SettingsField>

          <SettingsField
            label="Professional biography"
            wide
          >
            <textarea
              value={form.bio}
              onChange={(event) =>
                onChange(
                  "bio",
                  event.target.value
                )
              }
              maxLength={600}
              placeholder="Add a short professional summary visible to your team."
            />

            <small>
              {form.bio.length}/600 characters
            </small>
          </SettingsField>
        </div>

        <SettingsFooter
          saving={saving}
          submitLabel="Save profile"
        />
      </form>
    </SettingsPanel>
  );
}

function WorkPreferencesSection({
  form,
  saving,
  onChange,
  onWorkingHoursChange,
  onSubmit,
}) {
  return (
    <SettingsPanel
      title="Work preferences"
      subtitle="Configure your timezone, language, availability and normal working hours."
    >
      <form onSubmit={onSubmit}>
        <div className="rf-settings-form-grid">
          <SettingsField label="Timezone">
            <select
              value={form.timezone}
              onChange={(event) =>
                onChange(
                  "timezone",
                  event.target.value
                )
              }
            >
              {uniqueStrings([
                form.timezone,
                ...TIMEZONE_OPTIONS,
              ]).map((timezone) => (
                <option
                  key={timezone}
                  value={timezone}
                >
                  {timezone.replace(/_/g, " ")}
                </option>
              ))}
            </select>

            <small>
              Server records remain in UTC and are displayed in this timezone.
            </small>
          </SettingsField>

          <SettingsField label="Language">
            <select
              value={form.language}
              onChange={(event) =>
                onChange(
                  "language",
                  event.target.value
                )
              }
            >
              {LANGUAGE_OPTIONS.map(
                (language) => (
                  <option
                    key={language.value}
                    value={language.value}
                  >
                    {language.label}
                  </option>
                )
              )}
            </select>
          </SettingsField>

          <SettingsField label="Appearance">
            <select
              value={form.theme}
              onChange={(event) =>
                onChange(
                  "theme",
                  event.target.value
                )
              }
            >
              {THEME_OPTIONS.map((theme) => (
                <option
                  key={theme.value}
                  value={theme.value}
                >
                  {theme.label}
                </option>
              ))}
            </select>
          </SettingsField>

          <SettingsField label="Availability status">
            <select
              value={form.availabilityStatus}
              onChange={(event) =>
                onChange(
                  "availabilityStatus",
                  event.target.value
                )
              }
            >
              {AVAILABILITY_OPTIONS.map(
                (status) => (
                  <option
                    key={status.value}
                    value={status.value}
                  >
                    {status.label}
                  </option>
                )
              )}
            </select>
          </SettingsField>
        </div>

        <section className="rf-settings-subsection">
          <header>
            <h3>Normal working hours</h3>

            <p>
              These hours help managers understand your expected availability.
            </p>
          </header>

          <div className="rf-working-hours-list">
            {WEEK_DAYS.map((day) => {
              const settings =
                form.workingHours[day.id] ||
                DEFAULT_WORKING_HOURS[day.id];

              return (
                <article
                  key={day.id}
                  className={`rf-working-hours-row ${
                    settings.enabled
                      ? "is-enabled"
                      : ""
                  }`}
                >
                  <label className="rf-settings-switch">
                    <input
                      type="checkbox"
                      checked={settings.enabled}
                      onChange={(event) =>
                        onWorkingHoursChange(
                          day.id,
                          "enabled",
                          event.target.checked
                        )
                      }
                    />

                    <span />

                    <strong>
                      {day.label}
                    </strong>
                  </label>

                  <div>
                    <input
                      type="time"
                      value={settings.start}
                      disabled={!settings.enabled}
                      onChange={(event) =>
                        onWorkingHoursChange(
                          day.id,
                          "start",
                          event.target.value
                        )
                      }
                    />

                    <span>to</span>

                    <input
                      type="time"
                      value={settings.end}
                      disabled={!settings.enabled}
                      onChange={(event) =>
                        onWorkingHoursChange(
                          day.id,
                          "end",
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <small>
                    {settings.enabled
                      ? calculateWorkingHourLabel(
                          settings.start,
                          settings.end
                        )
                      : "Not working"}
                  </small>
                </article>
              );
            })}
          </div>
        </section>

        <SettingsFooter
          saving={saving}
          submitLabel="Save work preferences"
        />
      </form>
    </SettingsPanel>
  );
}

function NotificationPreferencesSection({
  form,
  saving,
  onChange,
  onSubmit,
}) {
  const notificationItems = [
    {
      field: "assignmentCreated",
      title: "New lead assignments",
      description:
        "Notify me when a manager assigns new leads.",
    },
    {
      field: "assignmentUpdated",
      title: "Assignment updates",
      description:
        "Notify me when lead instructions or priority changes.",
    },
    {
      field: "taskCreated",
      title: "New tasks",
      description:
        "Notify me when a manager assigns a new task.",
    },
    {
      field: "taskUpdated",
      title: "Task updates",
      description:
        "Notify me when a task changes.",
    },
    {
      field: "chatMessages",
      title: "Team messages",
      description:
        "Notify me about new direct messages and group conversations.",
    },
    {
      field: "mentions",
      title: "Mentions",
      description:
        "Notify me when another team member mentions me.",
    },
    {
      field: "callUpdates",
      title: "Call status updates",
      description:
        "Notify me when calling jobs change or complete.",
    },
    {
      field: "auditCompleted",
      title: "Audit reports",
      description:
        "Notify me when a mini or full audit report is ready.",
    },
    {
      field: "attendanceReminders",
      title: "Attendance reminders",
      description:
        "Remind me to check in or check out.",
    },
  ];

  return (
    <SettingsPanel
      title="Notification preferences"
      subtitle="Choose which workspace events should notify you."
    >
      <form onSubmit={onSubmit}>
        <div className="rf-settings-channel-grid">
          <NotificationChannelCard
            title="Browser notifications"
            description="Show desktop alerts while ReachFly is open."
            checked={form.browserNotifications}
            onChange={(value) =>
              onChange(
                "browserNotifications",
                value
              )
            }
          />

          <NotificationChannelCard
            title="Email notifications"
            description="Send important alerts to your login email."
            checked={form.emailNotifications}
            onChange={(value) =>
              onChange(
                "emailNotifications",
                value
              )
            }
          />

          <NotificationChannelCard
            title="Notification sounds"
            description="Play an alert sound for new messages and assignments."
            checked={form.soundEnabled}
            onChange={(value) =>
              onChange(
                "soundEnabled",
                value
              )
            }
          />
        </div>

        <section className="rf-settings-toggle-list">
          {notificationItems.map((item) => (
            <ToggleSetting
              key={item.field}
              title={item.title}
              description={item.description}
              checked={Boolean(form[item.field])}
              onChange={(value) =>
                onChange(item.field, value)
              }
            />
          ))}
        </section>

        <SettingsFooter
          saving={saving}
          submitLabel="Save notification settings"
        />
      </form>
    </SettingsPanel>
  );
}

function CallingPreferencesSection({
  form,
  dialers,
  profile,
  saving,
  onChange,
  onSubmit,
}) {
  const assignedDialer =
    profile?.assignedDialer ||
    dialers.find(
      (dialer) =>
        dialer.id ===
        profile?.assignedDialerId
    );

  return (
    <SettingsPanel
      title="Calling preferences"
      subtitle="Configure how the lead call workspace behaves."
    >
      <form onSubmit={onSubmit}>
        <div className="rf-settings-form-grid">
          <SettingsField label="Preferred dialer">
            <select
              value={form.preferredDialerId}
              onChange={(event) =>
                onChange(
                  "preferredDialerId",
                  event.target.value
                )
              }
            >
              <option value="">
                Use assigned default
              </option>

              {dialers.map((dialer) => (
                <option
                  key={dialer.id}
                  value={dialer.id}
                >
                  {dialer.name ||
                    dialer.fromNumber ||
                    "Workspace dialer"}
                </option>
              ))}
            </select>

            <small>
              Managers control which dialers are available to your account.
            </small>
          </SettingsField>

          <SettingsField label="Assigned phone number">
            <input
              value={
                assignedDialer?.fromNumber ||
                assignedDialer?.phoneNumber ||
                "No dialer assigned"
              }
              disabled
            />
          </SettingsField>
        </div>

        <section className="rf-settings-toggle-list">
          <ToggleSetting
            title="Open mini audit automatically"
            description="Display the mini audit when a lead opens in the call workspace."
            checked={form.autoOpenMiniAudit}
            onChange={(value) =>
              onChange(
                "autoOpenMiniAudit",
                value
              )
            }
          />

          <ToggleSetting
            title="Start the call timer automatically"
            description="Begin timing when the dialer reports that a call has started."
            checked={form.autoStartCallTimer}
            onChange={(value) =>
              onChange(
                "autoStartCallTimer",
                value
              )
            }
          />

          <ToggleSetting
            title="Confirm before calling"
            description="Show a confirmation prompt before starting an external call."
            checked={form.confirmBeforeCalling}
            onChange={(value) =>
              onChange(
                "confirmBeforeCalling",
                value
              )
            }
          />

          <ToggleSetting
            title="Call status sounds"
            description="Play tones when a call connects, fails or ends."
            checked={form.enableCallSounds}
            onChange={(value) =>
              onChange(
                "enableCallSounds",
                value
              )
            }
          />

          <ToggleSetting
            title="Display the call script"
            description="Show manager instructions and the active call script."
            checked={form.showCallScript}
            onChange={(value) =>
              onChange(
                "showCallScript",
                value
              )
            }
          />

          <ToggleSetting
            title="Speaker enabled by default"
            description="Enable call audio output when the call workspace opens."
            checked={form.defaultSpeakerEnabled}
            onChange={(value) =>
              onChange(
                "defaultSpeakerEnabled",
                value
              )
            }
          />

          <ToggleSetting
            title="Microphone enabled by default"
            description="Enable microphone input when a WebRTC call begins."
            checked={form.defaultMicrophoneEnabled}
            onChange={(value) =>
              onChange(
                "defaultMicrophoneEnabled",
                value
              )
            }
          />
        </section>

        <SettingsFooter
          saving={saving}
          submitLabel="Save calling preferences"
        />
      </form>
    </SettingsPanel>
  );
}

function EmailPreferencesSection({
  form,
  senders,
  profile,
  canConfigureSender,
  saving,
  onChange,
  onSubmit,
}) {
  const assignedSender =
    profile?.assignedSender ||
    senders.find(
      (sender) =>
        sender.id ===
        profile?.assignedSenderId
    );

  return (
    <SettingsPanel
      title="Email preferences"
      subtitle="Choose your approved sender identity and default email signature."
    >
      <form onSubmit={onSubmit}>
        <div className="rf-settings-form-grid">
          <SettingsField label="Preferred sender identity">
            <select
              value={form.preferredSenderId}
              onChange={(event) =>
                onChange(
                  "preferredSenderId",
                  event.target.value
                )
              }
            >
              <option value="">
                Use assigned default
              </option>

              {senders.map((sender) => (
                <option
                  key={sender.id}
                  value={sender.id}
                >
                  {sender.fromName ||
                    sender.name ||
                    "Sender"}{" "}
                  —{" "}
                  {sender.fromEmail}
                </option>
              ))}
            </select>

            <small>
              Only approved workspace sender identities are shown.
            </small>
          </SettingsField>

          <SettingsField label="Assigned sender">
            <input
              value={
                assignedSender?.fromEmail ||
                assignedSender?.email ||
                "No sender assigned"
              }
              disabled
            />
          </SettingsField>

          <SettingsField
            label="Email signature"
            wide
          >
            <textarea
              value={form.signature}
              onChange={(event) =>
                onChange(
                  "signature",
                  event.target.value
                )
              }
              maxLength={2000}
              placeholder={`Regards,\n${profile?.name || "Your name"}`}
            />

            <small>
              Plain text signature added to manual and campaign emails.
            </small>
          </SettingsField>
        </div>

        <section className="rf-settings-toggle-list">
          <ToggleSetting
            title="Include signature automatically"
            description="Append your signature when composing a new email."
            checked={form.includeSignature}
            onChange={(value) =>
              onChange(
                "includeSignature",
                value
              )
            }
          />

          <ToggleSetting
            title="Track email opens"
            description="Record available email open events for sent messages."
            checked={form.trackOpens}
            onChange={(value) =>
              onChange(
                "trackOpens",
                value
              )
            }
          />

          <ToggleSetting
            title="Track link clicks"
            description="Record available link click events for sent messages."
            checked={form.trackClicks}
            onChange={(value) =>
              onChange(
                "trackClicks",
                value
              )
            }
          />
        </section>

        {canConfigureSender ? (
          <div className="rf-settings-information-box">
            <strong>Sender administration</strong>

            <p>
              Your role can create and manage SMTP sender identities
              from the Email Setup or Team Management area. SMTP
              passwords remain encrypted and are never displayed here.
            </p>

            <a href="/app/email-setup">
              Open email setup
            </a>
          </div>
        ) : null}

        <SettingsFooter
          saving={saving}
          submitLabel="Save email preferences"
        />
      </form>
    </SettingsPanel>
  );
}

function SecuritySection({
  profile,
  passwordForm,
  sessions,
  savingPassword,
  terminatingSessionId,
  onPasswordChange,
  onChangePassword,
  onTerminateSession,
  onTerminateOtherSessions,
}) {
  return (
    <div className="rf-settings-security-stack">
      <SettingsPanel
        title="Change password"
        subtitle="Use a unique password that is not used for another account."
      >
        <form onSubmit={onChangePassword}>
          <div className="rf-settings-form-grid">
            <SettingsField
              label="Current password"
              required
              wide
            >
              <input
                type="password"
                value={
                  passwordForm.currentPassword
                }
                onChange={(event) =>
                  onPasswordChange(
                    "currentPassword",
                    event.target.value
                  )
                }
                autoComplete="current-password"
                required
              />
            </SettingsField>

            <SettingsField
              label="New password"
              required
            >
              <input
                type="password"
                value={
                  passwordForm.newPassword
                }
                onChange={(event) =>
                  onPasswordChange(
                    "newPassword",
                    event.target.value
                  )
                }
                autoComplete="new-password"
                minLength={10}
                required
              />
            </SettingsField>

            <SettingsField
              label="Confirm new password"
              required
            >
              <input
                type="password"
                value={
                  passwordForm.confirmPassword
                }
                onChange={(event) =>
                  onPasswordChange(
                    "confirmPassword",
                    event.target.value
                  )
                }
                autoComplete="new-password"
                minLength={10}
                required
              />
            </SettingsField>
          </div>

          <PasswordStrength
            password={
              passwordForm.newPassword
            }
          />

          <SettingsFooter
            saving={savingPassword}
            submitLabel="Change password"
          />
        </form>
      </SettingsPanel>

      <SettingsPanel
        title="Account security"
        subtitle="Review the security status of your account."
      >
        <div className="rf-security-summary-grid">
          <SecuritySummary
            label="Account status"
            value={formatLabel(
              profile?.status ||
                "active"
            )}
            status={
              normalizeStatus(
                profile?.status
              ) === "suspended"
                ? "danger"
                : "success"
            }
          />

          <SecuritySummary
            label="Email verification"
            value={
              profile?.emailVerifiedAt ||
              profile?.emailVerified
                ? "Verified"
                : "Not verified"
            }
            status={
              profile?.emailVerifiedAt ||
              profile?.emailVerified
                ? "success"
                : "warning"
            }
          />

          <SecuritySummary
            label="Two-factor authentication"
            value={
              profile?.twoFactorEnabled
                ? "Enabled"
                : "Not enabled"
            }
            status={
              profile?.twoFactorEnabled
                ? "success"
                : "warning"
            }
          />

          <SecuritySummary
            label="Last password change"
            value={formatDateTime(
              profile?.passwordChangedAt
            )}
            status="neutral"
          />
        </div>
      </SettingsPanel>

      <SettingsPanel
        title="Active sessions"
        subtitle="Devices currently signed in to your ReachFly account."
        action={
          sessions.length > 1 ? (
            <button
              type="button"
              className="rf-button rf-button--secondary rf-button--compact"
              onClick={onTerminateOtherSessions}
              disabled={
                terminatingSessionId ===
                "all"
              }
            >
              {terminatingSessionId === "all"
                ? "Signing out…"
                : "Sign out other sessions"}
            </button>
          ) : null
        }
      >
        {!sessions.length ? (
          <EmptySettingsState
            icon="SS"
            title="No session information"
            description="Active session information is not available."
          />
        ) : (
          <div className="rf-session-list">
            {sessions.map((session) => {
              const isCurrent =
                session.current ||
                session.isCurrent;

              return (
                <article
                  key={session.id}
                  className="rf-session-card"
                >
                  <span className="rf-session-card__icon">
                    {deviceIcon(
                      session.deviceType ||
                        session.userAgent
                    )}
                  </span>

                  <div className="rf-session-card__content">
                    <strong>
                      {session.deviceName ||
                        parseDeviceName(
                          session.userAgent
                        )}
                    </strong>

                    <span>
                      {[
                        session.browser,
                        session.operatingSystem,
                        session.ipAddress,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>

                    <small>
                      Last active{" "}
                      {formatDateTime(
                        session.lastActiveAt ||
                          session.updatedAt ||
                          session.createdAt
                      )}
                    </small>
                  </div>

                  <div className="rf-session-card__actions">
                    {isCurrent ? (
                      <StatusBadge value="current" />
                    ) : (
                      <button
                        type="button"
                        className="rf-settings-danger-link"
                        onClick={() =>
                          onTerminateSession(
                            session.id
                          )
                        }
                        disabled={
                          terminatingSessionId ===
                          session.id
                        }
                      >
                        {terminatingSessionId === session.id
                          ? "Signing out…"
                          : "Sign out"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SettingsPanel>
    </div>
  );
}

function SettingsPanel({
  title,
  subtitle,
  action,
  children,
}) {
  return (
    <section className="rf-panel rf-settings-panel">
      <header className="rf-panel-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        {action}
      </header>

      {children}
    </section>
  );
}

function SettingsField({
  label,
  required = false,
  wide = false,
  children,
}) {
  return (
    <label
      className={`rf-settings-field ${
        wide
          ? "rf-settings-field--wide"
          : ""
      }`}
    >
      <span>
        {label}
        {required ? <b> *</b> : null}
      </span>

      {children}
    </label>
  );
}

function SettingsFooter({
  saving,
  submitLabel,
}) {
  return (
    <footer className="rf-settings-form-footer">
      <button
        type="submit"
        className="rf-button"
        disabled={saving}
      >
        {saving
          ? "Saving changes…"
          : submitLabel}
      </button>
    </footer>
  );
}

function ToggleSetting({
  title,
  description,
  checked,
  onChange,
}) {
  return (
    <label className="rf-settings-toggle-row">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <span className="rf-settings-switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) =>
            onChange(event.target.checked)
          }
        />

        <span />
      </span>
    </label>
  );
}

function NotificationChannelCard({
  title,
  description,
  checked,
  onChange,
}) {
  return (
    <article
      className={`rf-notification-channel-card ${
        checked
          ? "is-enabled"
          : ""
      }`}
    >
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <label className="rf-settings-switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) =>
            onChange(event.target.checked)
          }
        />

        <span />
      </label>
    </article>
  );
}

function SecuritySummary({
  label,
  value,
  status,
}) {
  return (
    <article
      className={`rf-security-summary rf-security-summary--${status}`}
    >
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}

function PasswordStrength({
  password,
}) {
  const strength = calculatePasswordStrength(password);

  return (
    <div className="rf-password-strength">
      <div>
        {Array.from({
          length: 4,
        }).map((_, index) => (
          <span
            key={index}
            className={
              index < strength.score
                ? `is-active is-${strength.level}`
                : ""
            }
          />
        ))}
      </div>

      <p>
        <strong>
          {password
            ? strength.label
            : "Password requirements"}
        </strong>

        <span>
          Use at least 10 characters with uppercase, lowercase,
          numbers and symbols.
        </span>
      </p>
    </div>
  );
}

function EmptySettingsState({
  icon,
  title,
  description,
}) {
  return (
    <div className="rf-empty-state">
      <div className="rf-empty-state__icon">
        {icon}
      </div>

      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function ProfileAvatar({
  profile = {},
  large = false,
  extraLarge = false,
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <span
      className={[
        "rf-avatar",
        large
          ? "rf-avatar--large"
          : "",
        extraLarge
          ? "rf-settings-avatar--extra-large"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {profile.avatarUrl &&
      !imageFailed ? (
        <img
          src={profile.avatarUrl}
          alt={
            profile.name ||
            "Profile"
          }
          onError={() =>
            setImageFailed(true)
          }
        />
      ) : (
        <span>
          {getInitials(
            profile.name ||
              profile.email ||
              "RF"
          )}
        </span>
      )}
    </span>
  );
}

function StatusBadge({
  value,
}) {
  const status = normalizeStatus(
    value || "unknown"
  );

  return (
    <span
      className={`rf-dashboard-status rf-dashboard-status--${status}`}
    >
      {formatLabel(status)}
    </span>
  );
}

function SettingsAlert({
  type,
  message,
  onClose,
}) {
  const success = type === "success";

  return (
    <div
      className="rf-inline-alert"
      style={
        success
          ? {
              color: "#16794d",
              background: "#eaf8f1",
              borderColor: "#cbe9da",
            }
          : undefined
      }
    >
      <span>{message}</span>

      <button
        type="button"
        onClick={onClose}
        style={
          success
            ? {
                color: "#16794d",
              }
            : undefined
        }
      >
        Close
      </button>
    </div>
  );
}

function ProfileSettingsSkeleton() {
  return (
    <main className="rf-role-dashboard">
      <div className="rf-dashboard-skeleton-header" />

      <section className="rf-settings-layout">
        <div className="rf-settings-skeleton-navigation" />
        <div className="rf-dashboard-skeleton-panel" />
      </section>
    </main>
  );
}

function createEmptyProfileForm() {
  return {
    name: "",
    firstName: "",
    lastName: "",
    jobTitle: "",
    department: "",
    phone: "",
    email: "",
    bio: "",
  };
}

function createEmptyWorkForm() {
  return {
    timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC",
    language: "en",
    theme: "system",
    availabilityStatus: "offline",
    workingHours: DEFAULT_WORKING_HOURS,
  };
}

function normalizeWorkingHours(value) {
  const output = {};

  for (const day of WEEK_DAYS) {
    const settings =
      value?.[day.id] ||
      DEFAULT_WORKING_HOURS[day.id];

    output[day.id] = {
      enabled:
        typeof settings.enabled === "boolean"
          ? settings.enabled
          : DEFAULT_WORKING_HOURS[day.id].enabled,
      start:
        settings.start ||
        DEFAULT_WORKING_HOURS[day.id].start,
      end:
        settings.end ||
        DEFAULT_WORKING_HOURS[day.id].end,
    };
  }

  return output;
}

function calculateWorkingHourLabel(start, end) {
  if (!start || !end) {
    return "Hours incomplete";
  }

  const [startHour, startMinute] = start
    .split(":")
    .map(Number);

  const [endHour, endMinute] = end
    .split(":")
    .map(Number);

  const startMinutes =
    startHour * 60 +
    startMinute;

  const endMinutes =
    endHour * 60 +
    endMinute;

  const duration =
    endMinutes - startMinutes;

  if (duration <= 0) {
    return "Invalid time range";
  }

  const hours = Math.floor(
    duration / 60
  );

  const minutes =
    duration % 60;

  if (!minutes) {
    return `${hours} hour${
      hours === 1 ? "" : "s"
    }`;
  }

  return `${hours}h ${minutes}m`;
}

function calculatePasswordStrength(password) {
  if (!password) {
    return {
      score: 0,
      level: "weak",
      label: "Enter a new password",
    };
  }

  let score = 0;

  if (password.length >= 10) {
    score += 1;
  }

  if (
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password)
  ) {
    score += 1;
  }

  if (/\d/.test(password)) {
    score += 1;
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 1;
  }

  if (score <= 1) {
    return {
      score,
      level: "weak",
      label: "Weak password",
    };
  }

  if (score === 2) {
    return {
      score,
      level: "medium",
      label: "Moderate password",
    };
  }

  if (score === 3) {
    return {
      score,
      level: "good",
      label: "Good password",
    };
  }

  return {
    score,
    level: "strong",
    label: "Strong password",
  };
}

async function resizeImageFile(
  file,
  {
    maxWidth,
    maxHeight,
    quality,
  }
) {
  const dataUrl =
    await readFileAsDataUrl(file);

  const image =
    await loadImage(dataUrl);

  const scale = Math.min(
    1,
    maxWidth / image.width,
    maxHeight / image.height
  );

  const width = Math.max(
    1,
    Math.round(
      image.width * scale
    )
  );

  const height = Math.max(
    1,
    Math.round(
      image.height * scale
    )
  );

  const canvas =
    document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context =
    canvas.getContext("2d");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  context.drawImage(
    image,
    0,
    0,
    width,
    height
  );

  return canvas.toDataURL(
    "image/jpeg",
    quality
  );
}

function readFileAsDataUrl(file) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () =>
        resolve(reader.result);

      reader.onerror = () =>
        reject(
          new Error(
            "The selected image could not be read."
          )
        );

      reader.readAsDataURL(file);
    }
  );
}

function loadImage(source) {
  return new Promise(
    (resolve, reject) => {
      const image = new Image();

      image.onload = () =>
        resolve(image);

      image.onerror = () =>
        reject(
          new Error(
            "The selected image could not be processed."
          )
        );

      image.src = source;
    }
  );
}

function applyTheme(theme) {
  const root =
    document.documentElement;

  if (theme === "dark") {
    root.dataset.theme = "dark";
    return;
  }

  if (theme === "light") {
    root.dataset.theme = "light";
    return;
  }

  const prefersDark =
    window.matchMedia?.(
      "(prefers-color-scheme: dark)"
    ).matches;

  root.dataset.theme =
    prefersDark
      ? "dark"
      : "light";
}

function updateForm(
  setter,
  field,
  value
) {
  setter((current) => ({
    ...current,
    [field]: value,
  }));
}

function getSettledValue(
  result,
  fallback
) {
  return result.status === "fulfilled"
    ? result.value
    : fallback;
}

function normalizeRole(value) {
  const role =
    normalizeStatus(value);

  if (role.includes("owner")) {
    return "owner";
  }

  if (role.includes("admin")) {
    return "admin";
  }

  if (role.includes("manager")) {
    return "manager";
  }

  if (role.includes("caller")) {
    return "caller";
  }

  return role || "viewer";
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
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

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  ).format(date);
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}

function getFirstName(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)[0] || "";
}

function getLastName(value) {
  const words =
    String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  return words.length > 1
    ? words.slice(1).join(" ")
    : "";
}

function getInitials(value) {
  const words =
    String(value || "")
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

function uniqueStrings(values) {
  return [
    ...new Set(
      values.filter(Boolean)
    ),
  ];
}

function sectionIcon(section) {
  const icons = {
    profile: "PF",
    work: "WK",
    notifications: "NT",
    calling: "CL",
    email: "EM",
    security: "SC",
  };

  return icons[section] || "ST";
}

function deviceIcon(value) {
  const normalized =
    String(value || "")
      .toLowerCase();

  if (
    normalized.includes("mobile") ||
    normalized.includes("android") ||
    normalized.includes("iphone")
  ) {
    return "MB";
  }

  if (
    normalized.includes("tablet") ||
    normalized.includes("ipad")
  ) {
    return "TB";
  }

  return "PC";
}

function parseDeviceName(userAgent) {
  const value =
    String(userAgent || "");

  if (
    /iphone/i.test(value)
  ) {
    return "iPhone";
  }

  if (
    /ipad/i.test(value)
  ) {
    return "iPad";
  }

  if (
    /android/i.test(value)
  ) {
    return "Android device";
  }

  if (
    /macintosh|mac os/i.test(value)
  ) {
    return "Mac";
  }

  if (
    /windows/i.test(value)
  ) {
    return "Windows computer";
  }

  if (
    /linux/i.test(value)
  ) {
    return "Linux computer";
  }

  return "Unknown device";
}