import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Lock,
  Mail,
  Shield,
  Sparkles,
  Target,
  UserRound,
  Users,
  X,
  Zap,
} from "../components/icons";
import { useAuth } from "../auth/AuthContext";
import AuthLayout from "./AuthLayout";

const INITIAL_FORM = {
  name: "",
  email: "",
  password: "",
  accountType: "",
  role: "",
  companyName: "",
};

const WORKSPACE_TYPES = [
  {
    value: "individual",
    title: "I'm an individual",
    shortTitle: "Individual",
    icon: UserRound,
    description:
      "Founder, consultant, freelancer, or specialist running your own sales pipeline.",
    points: [
      "One focused sales workspace",
      "AI Voice Agent onboarding",
      "Lead discovery and outreach",
    ],
  },
  {
    value: "company",
    title: "We're a company",
    shortTitle: "Company",
    icon: Building2,
    description:
      "Agency, sales team, service business, or company operating a shared workspace.",
    points: [
      "Shared team workspace",
      "Role-based access",
      "Campaign and calling workflows",
    ],
  },
];

export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isCompany = form.accountType === "company";

  const selectedWorkspace = useMemo(
    () =>
      WORKSPACE_TYPES.find((item) => item.value === form.accountType) || null,
    [form.accountType]
  );

  const passwordScore = useMemo(
    () => getPasswordScore(form.password),
    [form.password]
  );

  const canContinueFromDetails = useMemo(() => {
    if (!form.name.trim()) return false;
    if (isCompany && !form.companyName.trim()) return false;
    if (!form.role.trim()) return false;
    return true;
  }, [form.companyName, form.name, form.role, isCompany]);

  const canSubmit = useMemo(
    () =>
      isValidEmail(form.email) &&
      form.password.length >= 8 &&
      canContinueFromDetails &&
      Boolean(form.accountType),
    [canContinueFromDetails, form.accountType, form.email, form.password]
  );

  function set(key, value) {
    if (loading) return;

    setError("");

    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "accountType" && value === "individual"
        ? {
            companyName: "",
          }
        : {}),
    }));
  }

  function selectWorkspace(value) {
    set("accountType", value);
  }

  function goToStep(nextStep) {
    if (loading) return;

    if (nextStep === 2 && !form.accountType) {
      setError("Choose the workspace type that matches how you sell.");
      return;
    }

    if (nextStep === 3) {
      const message = validateDetailsStep(form);

      if (message) {
        setError(message);
        return;
      }
    }

    setError("");
    setStep(nextStep);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document
          .querySelector(".rf-signup-v7 .rfsu-step-panel")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
      });
    }
  }

  async function submit(event) {
    event.preventDefault();

    if (loading) return;

    const name = form.name.trim();
    const companyName = form.companyName.trim();
    const role = form.role.trim();
    const email = form.email.trim().toLowerCase();

    if (!form.accountType) {
      setStep(1);
      setError("Choose your workspace type.");
      return;
    }

    const detailsError = validateDetailsStep(form);

    if (detailsError) {
      setStep(2);
      setError(detailsError);
      return;
    }

    if (!email) {
      setError("Enter your email address.");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (form.password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      /*
       * Keep the public signup payload compatible with the existing
       * ReachFly backend contract. Do not add onboarding-only fields here.
       */
      await signup({
        name,
        email,
        password: form.password,
        accountType: form.accountType,
        role,
        companyName: isCompany ? companyName : "",
      });

      /*
       * Preserve the existing post-signup product flow: new workspace owners
       * enter AI Voice Agent onboarding immediately after account creation.
       */
      navigate("/app/voice-agent?onboarding=1", {
        replace: true,
      });
    } catch (requestError) {
      setError(
        safeAuthMessage(
          requestError?.message ||
            "We could not create your ReachFly workspace. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SignupStyles />

      <AuthLayout
        eyebrow="Create account"
        title="Build your sales workspace around the way you work."
        text="Create your ReachFly workspace first. Then continue directly into AI Voice Agent onboarding to configure the calling workflow you actually need."
        footer={
          <>
            Already have a ReachFly account?{" "}
            <Link to="/login">
              Sign in
            </Link>
          </>
        }
      >
        <section className="rf-auth-form rf-signup-v7">
          <SignupMobileIntro step={step} />

          <SignupProgress
            step={step}
            onStepClick={(nextStep) => {
              if (nextStep < step) {
                goToStep(nextStep);
              }
            }}
          />

          {error ? (
            <SignupAlert
              text={error}
              onClose={() => setError("")}
            />
          ) : null}

          <div
            className="rfsu-step-panel"
            key={step}
          >
            {step === 1 ? (
              <WorkspaceTypeStep
                selected={form.accountType}
                onSelect={selectWorkspace}
                onContinue={() => goToStep(2)}
              />
            ) : null}

            {step === 2 ? (
              <ProfileDetailsStep
                form={form}
                isCompany={isCompany}
                selectedWorkspace={selectedWorkspace}
                loading={loading}
                onChange={set}
                onBack={() => goToStep(1)}
                onContinue={() => goToStep(3)}
                canContinue={canContinueFromDetails}
              />
            ) : null}

            {step === 3 ? (
              <AccountSecurityStep
                form={form}
                selectedWorkspace={selectedWorkspace}
                isCompany={isCompany}
                showPassword={showPassword}
                passwordScore={passwordScore}
                loading={loading}
                canSubmit={canSubmit}
                onChange={set}
                onTogglePassword={() =>
                  setShowPassword((current) => !current)
                }
                onBack={() => goToStep(2)}
                onSubmit={submit}
              />
            ) : null}
          </div>
        </section>
      </AuthLayout>
    </>
  );
}

function SignupMobileIntro({ step }) {
  return (
    <div className="rfsu-mobile-intro">
      <span>
        <Sparkles size={13} />
        ReachFly Sales OS
      </span>

      <h1>
        {step === 1
          ? "Create your workspace."
          : step === 2
            ? "Tell us about you."
            : "Secure your account."}
      </h1>

      <p>
        Three short steps, then we'll take you into Voice Agent setup.
      </p>
    </div>
  );
}

function SignupProgress({
  step,
  onStepClick,
}) {
  const steps = [
    {
      number: 1,
      label: "Workspace",
    },
    {
      number: 2,
      label: "Your details",
    },
    {
      number: 3,
      label: "Account",
    },
  ];

  return (
    <div
      className="rfsu-progress"
      aria-label={`Signup step ${step} of 3`}
    >
      {steps.map((item, index) => (
        <div
          className="rfsu-progress-segment"
          key={item.number}
        >
          <button
            type="button"
            className={[
              item.number === step ? "active" : "",
              item.number < step ? "complete" : "",
              item.number > step ? "future" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={item.number > step}
            onClick={() => onStepClick(item.number)}
            aria-current={item.number === step ? "step" : undefined}
          >
            <span>
              {item.number < step ? (
                <Check size={11} />
              ) : (
                item.number
              )}
            </span>

            <b>
              {item.label}
            </b>
          </button>

          {index < steps.length - 1 ? (
            <i
              className={
                item.number < step
                  ? "complete"
                  : ""
              }
              aria-hidden="true"
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function WorkspaceTypeStep({
  selected,
  onSelect,
  onContinue,
}) {
  return (
    <>
      <header className="rf-auth-card-head rfsu-card-head">
        <span className="rfsu-card-eyebrow">
          Step 1 of 3
        </span>

        <h2>
          How will you use ReachFly?
        </h2>

        <p>
          Choose the workspace structure that matches how you sell. This only
          sets up the correct account model; you can configure your actual
          outreach workflow after signup.
        </p>
      </header>

      <div className="rfsu-workspace-grid">
        {WORKSPACE_TYPES.map((item) => {
          const Icon = item.icon;
          const active = selected === item.value;

          return (
            <button
              type="button"
              key={item.value}
              className={`rfsu-workspace-card ${
                active
                  ? "active"
                  : ""
              }`}
              onClick={() => onSelect(item.value)}
              aria-pressed={active}
            >
              <header>
                <span>
                  <Icon size={21} />
                </span>

                {active ? (
                  <i>
                    <Check size={12} />
                  </i>
                ) : null}
              </header>

              <div>
                <strong>
                  {item.title}
                </strong>

                <p>
                  {item.description}
                </p>
              </div>

              <ul>
                {item.points.map((point) => (
                  <li key={point}>
                    <CheckCircle2 size={11} />

                    {point}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="rfsu-info-note">
        <span>
          <Zap size={15} />
        </span>

        <div>
          <strong>
            What happens after signup?
          </strong>

          <p>
            ReachFly takes the new workspace directly into AI Voice Agent
            onboarding so you can configure the agent, business-number setup,
            lead context, and launch workflow.
          </p>
        </div>
      </div>

      <div className="rfsu-single-action">
        <button
          className="rf-auth-submit"
          type="button"
          disabled={!selected}
          onClick={onContinue}
        >
          Continue

          <ArrowRight size={16} />
        </button>
      </div>
    </>
  );
}

function ProfileDetailsStep({
  form,
  isCompany,
  selectedWorkspace,
  loading,
  onChange,
  onBack,
  onContinue,
  canContinue,
}) {
  const WorkspaceIcon =
    selectedWorkspace?.icon ||
    UserRound;

  return (
    <>
      <header className="rf-auth-card-head rfsu-card-head">
        <span className="rfsu-card-eyebrow">
          Step 2 of 3
        </span>

        <h2>
          Tell us about you
        </h2>

        <p>
          We only need the details required to create the correct ReachFly
          workspace. Voice Agent configuration comes next.
        </p>
      </header>

      <div className="rfsu-selected-workspace">
        <span>
          <WorkspaceIcon size={15} />
        </span>

        <div>
          <small>
            Selected workspace
          </small>

          <strong>
            {selectedWorkspace?.shortTitle ||
              "Workspace"}
          </strong>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={onBack}
        >
          Change
        </button>
      </div>

      <div className="rfsu-details-grid">
        <SignupField
          label="Your name"
          icon={UserRound}
          name="name"
          autoComplete="name"
          value={form.name}
          onChange={(value) => onChange("name", value)}
          placeholder="Your full name"
          disabled={loading}
          required
        />

        {isCompany ? (
          <SignupField
            label="Company name"
            icon={Building2}
            name="organization"
            autoComplete="organization"
            value={form.companyName}
            onChange={(value) =>
              onChange(
                "companyName",
                value
              )
            }
            placeholder="e.g. Northstar Digital"
            disabled={loading}
            required
          />
        ) : null}

        <SignupField
          label={
            isCompany
              ? "Your role"
              : "What do you do?"
          }
          icon={
            isCompany
              ? Users
              : Target
          }
          name="role"
          autoComplete="organization-title"
          value={form.role}
          onChange={(value) => onChange("role", value)}
          placeholder={
            isCompany
              ? "e.g. Founder, Head of Sales"
              : "e.g. Growth consultant, founder"
          }
          disabled={loading}
          required
          wide={!isCompany}
        />
      </div>

      <div className="rfsu-privacy-note">
        <Shield size={13} />

        <p>
          These details create your authenticated workspace identity. We do not
          ask for campaign, calling, or billing configuration during account
          creation.
        </p>
      </div>

      <div className="rf-auth-form-actions rfsu-form-actions">
        <button
          className="rf-auth-back-btn"
          type="button"
          disabled={loading}
          onClick={onBack}
        >
          <ArrowLeft size={14} />

          Back
        </button>

        <button
          className="rf-auth-submit"
          type="button"
          disabled={
            loading ||
            !canContinue
          }
          onClick={onContinue}
        >
          Continue

          <ArrowRight size={15} />
        </button>
      </div>
    </>
  );
}

function AccountSecurityStep({
  form,
  selectedWorkspace,
  isCompany,
  showPassword,
  passwordScore,
  loading,
  canSubmit,
  onChange,
  onTogglePassword,
  onBack,
  onSubmit,
}) {
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rfsu-account-form"
    >
      <header className="rf-auth-card-head rfsu-card-head">
        <span className="rfsu-card-eyebrow">
          Step 3 of 3
        </span>

        <h2>
          Create your secure account
        </h2>

        <p>
          Add the credentials you'll use to sign in. Your workspace is created
          only when you submit this final step.
        </p>
      </header>

      <div className="rfsu-account-summary">
        <span>
          {isCompany ? (
            <Building2 size={15} />
          ) : (
            <UserRound size={15} />
          )}
        </span>

        <div>
          <small>
            Creating
          </small>

          <strong>
            {isCompany
              ? form.companyName.trim() ||
                "Company workspace"
              : `${form.name.trim() || "Your"} workspace`}
          </strong>

          <p>
            {selectedWorkspace?.shortTitle ||
              "ReachFly"}{" "}
            • {form.role.trim() || "Workspace owner"}
          </p>
        </div>
      </div>

      <div className="rfsu-account-fields">
        <SignupField
          label="Email address"
          icon={Mail}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={form.email}
          onChange={(value) => onChange("email", value)}
          placeholder="you@company.com"
          disabled={loading}
          required
        />

        <SignupField
          label="Password"
          icon={Lock}
          name="password"
          type={
            showPassword
              ? "text"
              : "password"
          }
          autoComplete="new-password"
          value={form.password}
          onChange={(value) => onChange("password", value)}
          placeholder="Minimum 8 characters"
          disabled={loading}
          minLength={8}
          required
          trailing={
            <button
              type="button"
              className="rfsu-password-toggle"
              disabled={loading}
              onClick={onTogglePassword}
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword
                ? "Hide"
                : "Show"}
            </button>
          }
        />

        <PasswordStrength
          password={form.password}
          score={passwordScore}
        />
      </div>

      <div className="rfsu-security-note">
        <span>
          <Lock size={14} />
        </span>

        <div>
          <strong>
            Your workspace stays scoped to your account
          </strong>

          <p>
            Team roles, leads, calls, billing, meetings, and AI Voice data are
            handled inside your authenticated ReachFly workspace.
          </p>
        </div>
      </div>

      <div className="rf-auth-form-actions rfsu-form-actions">
        <button
          className="rf-auth-back-btn"
          type="button"
          disabled={loading}
          onClick={onBack}
        >
          <ArrowLeft size={14} />

          Back
        </button>

        <button
          className="rf-auth-submit"
          type="submit"
          disabled={
            loading ||
            !canSubmit
          }
        >
          {loading ? (
            <>
              <span className="rfsu-spinner" />

              Creating workspace…
            </>
          ) : (
            <>
              Create workspace

              <ArrowRight size={15} />
            </>
          )}
        </button>
      </div>

      <p className="rfsu-submit-caption">
        By creating the workspace, you are creating a ReachFly account using
        the information above. Product configuration starts after signup.
      </p>
    </form>
  );
}

function SignupField({
  label,
  icon: Icon,
  name,
  type = "text",
  inputMode,
  autoComplete,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  minLength,
  trailing,
  wide = false,
}) {
  return (
    <label
      className={`rfsu-field ${
        wide
          ? "wide"
          : ""
      }`}
    >
      <span>
        {label}

        {required ? (
          <em>
            *
          </em>
        ) : null}
      </span>

      <div>
        <Icon size={15} />

        <input
          name={name}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          minLength={minLength}
        />

        {trailing}
      </div>
    </label>
  );
}

function PasswordStrength({
  password,
  score,
}) {
  const label =
    !password
      ? "Use at least 8 characters"
      : score <= 1
        ? "Basic"
        : score === 2
          ? "Good"
          : "Strong";

  return (
    <div className="rfsu-password-strength">
      <div>
        {[1, 2, 3, 4].map((level) => (
          <i
            key={level}
            className={
              level <= score
                ? "active"
                : ""
            }
          />
        ))}
      </div>

      <span>
        {label}
      </span>
    </div>
  );
}

function SignupAlert({
  text,
  onClose,
}) {
  return (
    <div
      className="rfsu-alert"
      role="alert"
    >
      <span>
        <X size={13} />
      </span>

      <div>
        <strong>
          Check this step
        </strong>

        <p>
          {text}
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss signup error"
      >
        <X size={11} />
      </button>
    </div>
  );
}

function validateDetailsStep(form) {
  if (!form.name.trim()) {
    return "Enter your name to continue.";
  }

  if (
    form.accountType === "company" &&
    !form.companyName.trim()
  ) {
    return "Enter your company name to continue.";
  }

  if (!form.role.trim()) {
    return form.accountType === "company"
      ? "Enter your role at the company to continue."
      : "Tell us what you do to continue.";
  }

  return "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || "").trim()
  );
}

function getPasswordScore(value) {
  const password = String(value || "");

  if (!password) return 0;

  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

  return Math.min(4, score);
}

function safeAuthMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/Supabase/gi, "authentication service");
}

function SignupStyles() {
  return (
    <style>{`
      .rf-signup-v7{
        --rfsu-text:#191c1d;
        --rfsu-text2:#464554;
        --rfsu-muted:#767586;
        --rfsu-line:#e2e4e7;
        --rfsu-soft:#f3f4f5;
        --rfsu-primary:#4648d4;
        --rfsu-primary-dark:#3537bb;
        --rfsu-primary-soft:#e8e9ff;
        --rfsu-violet:#6b38d4;
        --rfsu-success:#087a51;
        --rfsu-success-soft:#dff8eb;
        --rfsu-danger:#ba1a1a;
        --rfsu-danger-soft:#ffedeb;
        --rfsu-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
      }

      .rf-signup-v7 *,
      .rf-signup-v7 *::before,
      .rf-signup-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfsuStepIn{
        from{
          opacity:0;
          transform:translate3d(0,7px,0);
        }
        to{
          opacity:1;
          transform:none;
        }
      }

      @keyframes rfsuSpin{
        to{
          transform:rotate(360deg);
        }
      }

      .rfsu-mobile-intro{
        display:none;
      }

      .rfsu-progress{
        display:flex;
        align-items:center;
        margin:0 0 20px;
      }

      .rfsu-progress-segment{
        min-width:0;
        display:flex;
        align-items:center;
        flex:1 1 0;
      }

      .rfsu-progress-segment:last-child{
        flex:0 0 auto;
      }

      .rfsu-progress-segment > button{
        display:flex;
        align-items:center;
        gap:6px;
        padding:0;
        color:#9899a2;
        background:transparent;
        border:0;
        cursor:pointer;
        font:inherit;
      }

      .rfsu-progress-segment > button:disabled{
        cursor:default;
      }

      .rfsu-progress-segment > button > span{
        width:23px;
        height:23px;
        display:grid;
        place-items:center;
        flex:0 0 23px;
        color:#777985;
        background:#eceeef;
        border-radius:50%;
        font-size:6px;
        font-weight:800;
        transition:.16s var(--rfsu-ease);
      }

      .rfsu-progress-segment > button > b{
        font-size:6px;
        font-weight:700;
        white-space:nowrap;
      }

      .rfsu-progress-segment > button.active{
        color:var(--rfsu-primary);
      }

      .rfsu-progress-segment > button.active > span{
        color:#fff;
        background:var(--rfsu-primary);
        box-shadow:0 4px 10px rgba(70,72,212,.14);
      }

      .rfsu-progress-segment > button.complete{
        color:#5557c9;
      }

      .rfsu-progress-segment > button.complete > span{
        color:var(--rfsu-primary);
        background:var(--rfsu-primary-soft);
      }

      .rfsu-progress-segment > i{
        height:1px;
        flex:1 1 auto;
        margin:0 8px;
        background:#e2e4e7;
      }

      .rfsu-progress-segment > i.complete{
        background:#bfc0fa;
      }

      .rfsu-step-panel{
        animation:rfsuStepIn 220ms var(--rfsu-ease);
      }

      .rfsu-card-head{
        margin-bottom:15px!important;
      }

      .rfsu-card-eyebrow{
        display:block;
        margin-bottom:4px;
        color:var(--rfsu-primary);
        font-size:6px;
        font-weight:800;
        letter-spacing:.10em;
        text-transform:uppercase;
      }

      .rfsu-card-head h2{
        font-size:25px!important;
        line-height:31px!important;
      }

      .rfsu-card-head p{
        max-width:420px;
      }

      .rfsu-alert{
        display:grid;
        grid-template-columns:25px minmax(0,1fr) 22px;
        align-items:start;
        gap:7px;
        padding:9px 10px;
        margin:0 0 13px;
        color:#7f1b1b;
        background:var(--rfsu-danger-soft);
        border:1px solid #ffd0cc;
        border-radius:8px;
        animation:rfsuStepIn 170ms var(--rfsu-ease);
      }

      .rfsu-alert > span{
        width:25px;
        height:25px;
        display:grid;
        place-items:center;
        color:var(--rfsu-danger);
        background:#fff;
        border-radius:7px;
      }

      .rfsu-alert > div{
        min-width:0;
      }

      .rfsu-alert strong{
        display:block;
        font-size:7px;
      }

      .rfsu-alert p{
        margin:1px 0 0;
        font-size:7px;
        line-height:11px;
      }

      .rfsu-alert > button{
        width:22px;
        height:22px;
        display:grid;
        place-items:center;
        padding:0;
        color:#9f5858;
        background:transparent;
        border:0;
        border-radius:5px;
        cursor:pointer;
      }

      .rfsu-workspace-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:9px;
      }

      .rfsu-workspace-card{
        position:relative;
        min-height:230px;
        display:grid;
        grid-template-rows:auto auto 1fr;
        align-content:start;
        gap:11px;
        padding:15px;
        color:inherit;
        background:#fff;
        border:1px solid var(--rfsu-line);
        border-radius:11px;
        text-align:left;
        cursor:pointer;
        transition:
          transform 150ms var(--rfsu-ease),
          border-color 150ms var(--rfsu-ease),
          box-shadow 150ms var(--rfsu-ease),
          background 150ms var(--rfsu-ease);
      }

      .rfsu-workspace-card:hover{
        transform:translateY(-2px);
        border-color:#cfd0fb;
        box-shadow:0 8px 20px rgba(25,28,29,.045);
      }

      .rfsu-workspace-card.active{
        background:
          linear-gradient(180deg,#fcfcff,#f8f8ff);
        border-color:var(--rfsu-primary);
        box-shadow:
          0 0 0 1px var(--rfsu-primary),
          0 8px 20px rgba(70,72,212,.06);
      }

      .rfsu-workspace-card > header{
        display:flex;
        align-items:center;
        justify-content:space-between;
      }

      .rfsu-workspace-card > header > span{
        width:43px;
        height:43px;
        display:grid;
        place-items:center;
        color:var(--rfsu-primary);
        background:var(--rfsu-primary-soft);
        border-radius:10px;
      }

      .rfsu-workspace-card.active > header > span{
        color:#fff;
        background:var(--rfsu-primary);
      }

      .rfsu-workspace-card > header > i{
        width:24px;
        height:24px;
        display:grid;
        place-items:center;
        color:#fff;
        background:var(--rfsu-primary);
        border-radius:50%;
        box-shadow:0 3px 8px rgba(70,72,212,.14);
      }

      .rfsu-workspace-card > div strong{
        display:block;
        color:var(--rfsu-text);
        font:600 11px/15px Geist,Inter,sans-serif;
      }

      .rfsu-workspace-card > div p{
        margin:4px 0 0;
        color:var(--rfsu-text2);
        font-size:7px;
        line-height:12px;
      }

      .rfsu-workspace-card ul{
        display:grid;
        align-content:end;
        gap:6px;
        padding:9px 0 0;
        margin:0;
        border-top:1px solid #f0f1f2;
        list-style:none;
      }

      .rfsu-workspace-card li{
        display:flex;
        align-items:center;
        gap:5px;
        color:#686a74;
        font-size:6.5px;
      }

      .rfsu-workspace-card li svg{
        color:var(--rfsu-primary);
        flex:0 0 auto;
      }

      .rfsu-info-note,
      .rfsu-security-note{
        display:flex;
        align-items:flex-start;
        gap:8px;
        padding:10px;
        margin-top:11px;
        color:var(--rfsu-violet);
        background:linear-gradient(135deg,#f2ecff,#faf8ff);
        border:1px solid #e5dcf8;
        border-radius:8px;
      }

      .rfsu-info-note > span,
      .rfsu-security-note > span{
        width:30px;
        height:30px;
        display:grid;
        place-items:center;
        flex:0 0 30px;
        color:#6b38d4;
        background:#fff;
        border-radius:7px;
      }

      .rfsu-info-note > div,
      .rfsu-security-note > div{
        min-width:0;
      }

      .rfsu-info-note strong,
      .rfsu-security-note strong{
        display:block;
        color:#5325b8;
        font-size:7px;
      }

      .rfsu-info-note p,
      .rfsu-security-note p{
        margin:2px 0 0;
        color:var(--rfsu-text2);
        font-size:6.5px;
        line-height:11px;
      }

      .rfsu-single-action{
        display:flex;
        justify-content:flex-end;
        margin-top:13px;
      }

      .rfsu-single-action .rf-auth-submit{
        width:auto!important;
        min-width:165px;
      }

      .rfsu-selected-workspace{
        min-height:57px;
        display:grid;
        grid-template-columns:33px minmax(0,1fr) auto;
        align-items:center;
        gap:8px;
        padding:9px;
        margin-bottom:13px;
        background:var(--rfsu-primary-soft);
        border:1px solid #d8d9ff;
        border-radius:8px;
      }

      .rfsu-selected-workspace > span{
        width:33px;
        height:33px;
        display:grid;
        place-items:center;
        color:var(--rfsu-primary);
        background:#fff;
        border-radius:8px;
      }

      .rfsu-selected-workspace > div{
        display:grid;
      }

      .rfsu-selected-workspace small{
        color:#7274ad;
        font-size:5.5px;
        text-transform:uppercase;
      }

      .rfsu-selected-workspace strong{
        color:#3436a5;
        font-size:8px;
      }

      .rfsu-selected-workspace > button{
        min-height:28px;
        padding:5px 7px;
        color:var(--rfsu-primary);
        background:#fff;
        border:1px solid #d9daf5;
        border-radius:6px;
        cursor:pointer;
        font-size:6px;
        font-weight:700;
      }

      .rfsu-details-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:11px;
      }

      .rfsu-field{
        min-width:0;
        display:grid;
        gap:5px;
      }

      .rfsu-field.wide{
        grid-column:1/-1;
      }

      .rfsu-field > span{
        color:var(--rfsu-text);
        font-size:7px;
        font-weight:700;
      }

      .rfsu-field > span em{
        margin-left:2px;
        color:var(--rfsu-danger);
        font-style:normal;
      }

      .rfsu-field > div{
        min-height:44px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:0 10px;
        color:#8a8b94;
        background:#fff;
        border:1px solid var(--rfsu-line);
        border-radius:8px;
        transition:
          border-color 140ms var(--rfsu-ease),
          box-shadow 140ms var(--rfsu-ease);
      }

      .rfsu-field > div:focus-within{
        border-color:rgba(70,72,212,.55);
        box-shadow:0 0 0 3px rgba(70,72,212,.07);
      }

      .rfsu-field > div > svg{
        flex:0 0 auto;
      }

      .rfsu-field input{
        min-width:0;
        width:100%;
        height:42px;
        padding:0;
        color:var(--rfsu-text);
        background:transparent;
        border:0;
        outline:0;
        font-size:9px;
      }

      .rfsu-field input::placeholder{
        color:#a3a4ac;
      }

      .rfsu-field input:disabled{
        cursor:not-allowed;
      }

      .rfsu-privacy-note{
        display:flex;
        align-items:flex-start;
        gap:7px;
        padding:9px 10px;
        margin-top:11px;
        color:var(--rfsu-primary);
        background:#f7f7fc;
        border-radius:8px;
      }

      .rfsu-privacy-note > svg{
        flex:0 0 auto;
        margin-top:1px;
      }

      .rfsu-privacy-note p{
        margin:0;
        color:var(--rfsu-text2);
        font-size:6.5px;
        line-height:11px;
      }

      .rfsu-form-actions{
        margin-top:13px!important;
      }

      .rfsu-form-actions .rf-auth-back-btn{
        min-width:90px;
      }

      .rfsu-form-actions .rf-auth-submit{
        min-width:170px!important;
      }

      .rfsu-account-form{
        display:grid;
      }

      .rfsu-account-summary{
        min-height:67px;
        display:grid;
        grid-template-columns:37px minmax(0,1fr);
        align-items:center;
        gap:9px;
        padding:10px;
        margin-bottom:13px;
        background:#f7f7f9;
        border:1px solid #eceef0;
        border-radius:9px;
      }

      .rfsu-account-summary > span{
        width:37px;
        height:37px;
        display:grid;
        place-items:center;
        color:var(--rfsu-primary);
        background:#fff;
        border-radius:9px;
        box-shadow:0 1px 3px rgba(25,28,29,.04);
      }

      .rfsu-account-summary > div{
        min-width:0;
      }

      .rfsu-account-summary small{
        display:block;
        color:var(--rfsu-muted);
        font-size:5.5px;
        text-transform:uppercase;
      }

      .rfsu-account-summary strong{
        display:block;
        overflow:hidden;
        color:var(--rfsu-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:8px;
      }

      .rfsu-account-summary p{
        margin:1px 0 0;
        overflow:hidden;
        color:var(--rfsu-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6px;
      }

      .rfsu-account-fields{
        display:grid;
        gap:11px;
      }

      .rfsu-password-toggle{
        min-width:38px;
        height:27px;
        padding:0 7px;
        color:var(--rfsu-primary);
        background:var(--rfsu-primary-soft);
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:6px;
        font-weight:750;
      }

      .rfsu-password-toggle:disabled{
        opacity:.45;
      }

      .rfsu-password-strength{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:9px;
        margin-top:-3px;
      }

      .rfsu-password-strength > div{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:4px;
        flex:1;
      }

      .rfsu-password-strength i{
        height:4px;
        display:block;
        background:#e6e7e9;
        border-radius:999px;
      }

      .rfsu-password-strength i.active{
        background:var(--rfsu-primary);
      }

      .rfsu-password-strength > span{
        min-width:85px;
        color:var(--rfsu-muted);
        text-align:right;
        font-size:6px;
      }

      .rfsu-security-note{
        color:var(--rfsu-primary);
        background:var(--rfsu-primary-soft);
        border-color:#dedfff;
      }

      .rfsu-security-note > span{
        color:var(--rfsu-primary);
      }

      .rfsu-security-note strong{
        color:#3739ac;
      }

      .rfsu-submit-caption{
        max-width:370px;
        margin:9px auto 0;
        color:var(--rfsu-muted);
        text-align:center;
        font-size:5.8px;
        line-height:9px;
      }

      .rfsu-spinner{
        width:12px;
        height:12px;
        display:block;
        border:2px solid currentColor;
        border-right-color:transparent;
        border-radius:50%;
        animation:rfsuSpin 700ms linear infinite;
      }

      .rf-signup-v7 .rf-auth-submit:focus-visible,
      .rfsu-workspace-card:focus-visible,
      .rfsu-password-toggle:focus-visible,
      .rfsu-selected-workspace > button:focus-visible,
      .rfsu-progress button:focus-visible{
        outline:3px solid rgba(70,72,212,.16);
        outline-offset:3px;
      }

      @media(max-width:620px){
        .rfsu-mobile-intro{
          display:block;
          margin-bottom:20px;
        }

        .rfsu-mobile-intro > span{
          display:inline-flex;
          align-items:center;
          gap:5px;
          color:var(--rfsu-primary);
          font-size:6px;
          font-weight:800;
          letter-spacing:.08em;
          text-transform:uppercase;
        }

        .rfsu-mobile-intro h1{
          margin:7px 0 0;
          font:600 27px/33px Geist,Inter,sans-serif;
          letter-spacing:-.03em;
        }

        .rfsu-mobile-intro p{
          margin:4px 0 0;
          color:var(--rfsu-text2);
          font-size:8px;
          line-height:13px;
        }

        .rfsu-progress{
          margin-bottom:17px;
        }

        .rfsu-progress-segment > button > b{
          display:none;
        }

        .rfsu-progress-segment > i{
          margin:0 6px;
        }

        .rfsu-card-head h2{
          font-size:21px!important;
          line-height:27px!important;
        }

        .rfsu-workspace-grid{
          grid-template-columns:1fr;
        }

        .rfsu-workspace-card{
          min-height:180px;
        }

        .rfsu-details-grid{
          grid-template-columns:1fr;
        }

        .rfsu-field.wide{
          grid-column:auto;
        }
      }

      @media(max-width:430px){
        .rfsu-single-action .rf-auth-submit{
          width:100%!important;
        }

        .rfsu-form-actions{
          display:grid!important;
          grid-template-columns:1fr!important;
        }

        .rfsu-form-actions .rf-auth-back-btn,
        .rfsu-form-actions .rf-auth-submit{
          width:100%!important;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rfsu-step-panel,
        .rfsu-alert,
        .rfsu-spinner{
          animation:none!important;
        }

        .rf-signup-v7 *,
        .rf-signup-v7 *::before,
        .rf-signup-v7 *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
