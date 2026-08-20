import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import GoogleAuthButton from "../components/GoogleAuthButton";
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
  const {
    signup,
    googleAuth,
  } = useAuth();
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const busy =
    loading ||
    googleLoading;

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
    if (busy) return;

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
    if (busy) return;

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
          .querySelector(".rf11-signup-v7 .rf11-signup-step-panel")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
      });
    }
  }

  async function submit(event) {
    event.preventDefault();

    if (busy) return;

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
      navigate("/app/voice-start?onboarding=1", {
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

  async function handleGoogleCredential(
    credential
  ) {
    if (busy) {
      return;
    }

    const detailsError =
      validateDetailsStep(form);

    if (detailsError) {
      setStep(2);
      setError(detailsError);
      return;
    }

    try {
      setGoogleLoading(true);
      setError("");

      await googleAuth(
        {
          credential,
          mode: "signup",
          name:
            form.name.trim(),
          accountType:
            form.accountType,
          role:
            form.role.trim(),
          companyName:
            isCompany
              ? form.companyName.trim()
              : "",
        },
        {
          rememberMe: true,
        }
      );

      navigate(
        "/app/voice-start?onboarding=1",
        {
          replace: true,
        }
      );
    } catch (requestError) {
      setError(
        safeAuthMessage(
          requestError?.message ||
            "Google signup could not be completed."
        )
      );
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <>
      <SignupStyles />
      <SignupV12ClarityStyles />
      <SignupContrastStyles />

      <AuthLayout
        eyebrow="Create account"
        title="Build the sales motion you want to run."
        text="Create the workspace, choose how your team sells, then configure the AI Voice and outreach workflow around that motion."
        footer={
          <>
            Already have a ReachFly account?{" "}
            <Link to="/login">
              Sign in
            </Link>
          </>
        }
      >
        <section className="rf11-auth-form rf11-signup-v7">
          <SignupMobileIntro step={step} />

          <SignupProgress
            step={step}
            onStepClick={(nextStep) => {
              if (nextStep < step) {
                goToStep(nextStep);
              }
            }}
          />

          <AnimatePresence initial={false}>
            {error ? (
              <motion.div
                key="signup-alert"
                initial={reduceMotion ? false : { opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, height: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22 }}
              >
                <SignupAlert
                  text={error}
                  onClose={() => setError("")}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className="rf11-signup-step-panel"
              key={step}
              initial={reduceMotion ? false : { opacity: 0, x: 24, filter: "blur(5px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -20, filter: "blur(4px)" }}
              transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.2, 0.8, 0.2, 1] }}
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
                loading={busy}
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
                loading={busy}
                googleLoading={googleLoading}
                canSubmit={canSubmit}
                onGoogleCredential={handleGoogleCredential}
                onGoogleError={(googleError) =>
                  setError(
                    safeAuthMessage(
                      googleError?.message ||
                        "Google signup could not be initialized."
                    )
                  )
                }
                onChange={set}
                onTogglePassword={() =>
                  setShowPassword((current) => !current)
                }
                onBack={() => goToStep(2)}
                onSubmit={submit}
              />
            ) : null}
            </motion.div>
          </AnimatePresence>
        </section>
      </AuthLayout>
    </>
  );
}

function SignupMobileIntro({ step }) {
  return (
    <div className="rf11-signup-mobile-intro">
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
      className="rf11-signup-progress"
      aria-label={`Signup step ${step} of 3`}
    >
      {steps.map((item, index) => (
        <div
          className="rf11-signup-progress-segment"
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
      <header className="rf11-auth-card-head rf11-signup-card-head">
        <span className="rf11-signup-card-eyebrow">
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

      <div className="rf11-signup-workspace-grid">
        {WORKSPACE_TYPES.map((item) => {
          const Icon = item.icon;
          const active = selected === item.value;

          return (
            <button
              type="button"
              key={item.value}
              className={`rf11-signup-workspace-card ${
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

      <div className="rf11-signup-info-note">
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

      <div className="rf11-signup-single-action">
        <button
          className="rf11-auth-submit"
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
      <header className="rf11-auth-card-head rf11-signup-card-head">
        <span className="rf11-signup-card-eyebrow">
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

      <div className="rf11-signup-selected-workspace">
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

      <div className="rf11-signup-details-grid">
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

      <div className="rf11-signup-privacy-note">
        <Shield size={13} />

        <p>
          These details create your authenticated workspace identity. We do not
          ask for campaign, calling, or billing configuration during account
          creation.
        </p>
      </div>

      <div className="rf11-auth-form-actions rf11-signup-form-actions">
        <button
          className="rf11-auth-back-btn"
          type="button"
          disabled={loading}
          onClick={onBack}
        >
          <ArrowLeft size={14} />

          Back
        </button>

        <button
          className="rf11-auth-submit"
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
  googleLoading,
  canSubmit,
  onGoogleCredential,
  onGoogleError,
  onChange,
  onTogglePassword,
  onBack,
  onSubmit,
}) {
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rf11-signup-account-form"
    >
      <header className="rf11-auth-card-head rf11-signup-card-head">
        <span className="rf11-signup-card-eyebrow">
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

      <div className="rf11-signup-account-summary">
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

      <div className="rf11-signup-google-block">
        <GoogleAuthButton
          mode="signup"
          onCredential={onGoogleCredential}
          onError={onGoogleError}
          disabled={loading}
        />

        <div className="rf11-signup-or">
          <span />
          <b>or continue with email</b>
          <span />
        </div>

        <div className="rf11-signup-starter-credit">
          <Sparkles size={13} />
          <span>
            <strong>10 free ReachFly credits</strong>
            {" "}are included when this workspace is created.
          </span>
        </div>
      </div>

      <div className="rf11-signup-account-fields">
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
              className="rf11-signup-password-toggle"
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

      <div className="rf11-signup-security-note">
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

      <div className="rf11-auth-form-actions rf11-signup-form-actions">
        <button
          className="rf11-auth-back-btn"
          type="button"
          disabled={loading}
          onClick={onBack}
        >
          <ArrowLeft size={14} />

          Back
        </button>

        <button
          className="rf11-auth-submit"
          type="submit"
          disabled={
            loading ||
            !canSubmit
          }
        >
          {loading ? (
            <>
              <span className="rf11-signup-spinner" />

              {googleLoading
                ? "Connecting Google…"
                : "Creating workspace…"}
            </>
          ) : (
            <>
              Create workspace

              <ArrowRight size={15} />
            </>
          )}
        </button>
      </div>

      <p className="rf11-signup-submit-caption">
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
      className={`rf11-signup-field ${
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
    <div className="rf11-signup-password-strength">
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
      className="rf11-signup-alert"
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
      .rf11-signup-v7{
        --rf11-signup-text:#191c1d;
        --rf11-signup-text2:#464554;
        --rf11-signup-muted:#767586;
        --rf11-signup-line:#e2e4e7;
        --rf11-signup-soft:#f3f4f5;
        --rf11-signup-primary:#4648d4;
        --rf11-signup-primary-dark:#3537bb;
        --rf11-signup-primary-soft:#e8e9ff;
        --rf11-signup-violet:#6b38d4;
        --rf11-signup-success:#087a51;
        --rf11-signup-success-soft:#dff8eb;
        --rf11-signup-danger:#ba1a1a;
        --rf11-signup-danger-soft:#ffedeb;
        --rf11-signup-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
      }

      .rf11-signup-v7 *,
      .rf11-signup-v7 *::before,
      .rf11-signup-v7 *::after{
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

      .rf11-signup-mobile-intro{
        display:none;
      }

      .rf11-signup-progress{
        display:flex;
        align-items:center;
        margin:0 0 20px;
      }

      .rf11-signup-progress-segment{
        min-width:0;
        display:flex;
        align-items:center;
        flex:1 1 0;
      }

      .rf11-signup-progress-segment:last-child{
        flex:0 0 auto;
      }

      .rf11-signup-progress-segment > button{
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

      .rf11-signup-progress-segment > button:disabled{
        cursor:default;
      }

      .rf11-signup-progress-segment > button > span{
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
        transition:.16s var(--rf11-signup-ease);
      }

      .rf11-signup-progress-segment > button > b{
        font-size:6px;
        font-weight:700;
        white-space:nowrap;
      }

      .rf11-signup-progress-segment > button.active{
        color:var(--rf11-signup-primary);
      }

      .rf11-signup-progress-segment > button.active > span{
        color:#fff;
        background:var(--rf11-signup-primary);
        box-shadow:0 4px 10px rgba(70,72,212,.14);
      }

      .rf11-signup-progress-segment > button.complete{
        color:#5557c9;
      }

      .rf11-signup-progress-segment > button.complete > span{
        color:var(--rf11-signup-primary);
        background:var(--rf11-signup-primary-soft);
      }

      .rf11-signup-progress-segment > i{
        height:1px;
        flex:1 1 auto;
        margin:0 8px;
        background:#e2e4e7;
      }

      .rf11-signup-progress-segment > i.complete{
        background:#bfc0fa;
      }

      .rf11-signup-step-panel{
        animation:rfsuStepIn 220ms var(--rf11-signup-ease);
      }

      .rf11-signup-card-head{
        margin-bottom:15px!important;
      }

      .rf11-signup-card-eyebrow{
        display:block;
        margin-bottom:4px;
        color:var(--rf11-signup-primary);
        font-size:6px;
        font-weight:800;
        letter-spacing:.10em;
        text-transform:uppercase;
      }

      .rf11-signup-card-head h2{
        font-size:25px!important;
        line-height:31px!important;
      }

      .rf11-signup-card-head p{
        max-width:420px;
      }

      .rf11-signup-alert{
        display:grid;
        grid-template-columns:25px minmax(0,1fr) 22px;
        align-items:start;
        gap:7px;
        padding:9px 10px;
        margin:0 0 13px;
        color:#7f1b1b;
        background:var(--rf11-signup-danger-soft);
        border:1px solid #ffd0cc;
        border-radius:8px;
        animation:rfsuStepIn 170ms var(--rf11-signup-ease);
      }

      .rf11-signup-alert > span{
        width:25px;
        height:25px;
        display:grid;
        place-items:center;
        color:var(--rf11-signup-danger);
        background:#fff;
        border-radius:7px;
      }

      .rf11-signup-alert > div{
        min-width:0;
      }

      .rf11-signup-alert strong{
        display:block;
        font-size:7px;
      }

      .rf11-signup-alert p{
        margin:1px 0 0;
        font-size:7px;
        line-height:11px;
      }

      .rf11-signup-alert > button{
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

      .rf11-signup-workspace-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:9px;
      }

      .rf11-signup-workspace-card{
        position:relative;
        min-height:230px;
        display:grid;
        grid-template-rows:auto auto 1fr;
        align-content:start;
        gap:11px;
        padding:15px;
        color:inherit;
        background:#fff;
        border:1px solid var(--rf11-signup-line);
        border-radius:11px;
        text-align:left;
        cursor:pointer;
        transition:
          transform 150ms var(--rf11-signup-ease),
          border-color 150ms var(--rf11-signup-ease),
          box-shadow 150ms var(--rf11-signup-ease),
          background 150ms var(--rf11-signup-ease);
      }

      .rf11-signup-workspace-card:hover{
        transform:translateY(-2px);
        border-color:#cfd0fb;
        box-shadow:0 8px 20px rgba(25,28,29,.045);
      }

      .rf11-signup-workspace-card.active{
        background:
          linear-gradient(180deg,#fcfcff,#f8f8ff);
        border-color:var(--rf11-signup-primary);
        box-shadow:
          0 0 0 1px var(--rf11-signup-primary),
          0 8px 20px rgba(70,72,212,.06);
      }

      .rf11-signup-workspace-card > header{
        display:flex;
        align-items:center;
        justify-content:space-between;
      }

      .rf11-signup-workspace-card > header > span{
        width:43px;
        height:43px;
        display:grid;
        place-items:center;
        color:var(--rf11-signup-primary);
        background:var(--rf11-signup-primary-soft);
        border-radius:10px;
      }

      .rf11-signup-workspace-card.active > header > span{
        color:#fff;
        background:var(--rf11-signup-primary);
      }

      .rf11-signup-workspace-card > header > i{
        width:24px;
        height:24px;
        display:grid;
        place-items:center;
        color:#fff;
        background:var(--rf11-signup-primary);
        border-radius:50%;
        box-shadow:0 3px 8px rgba(70,72,212,.14);
      }

      .rf11-signup-workspace-card > div strong{
        display:block;
        color:var(--rf11-signup-text);
        font:600 11px/15px Geist,Inter,sans-serif;
      }

      .rf11-signup-workspace-card > div p{
        margin:4px 0 0;
        color:var(--rf11-signup-text2);
        font-size:7px;
        line-height:12px;
      }

      .rf11-signup-workspace-card ul{
        display:grid;
        align-content:end;
        gap:6px;
        padding:9px 0 0;
        margin:0;
        border-top:1px solid #f0f1f2;
        list-style:none;
      }

      .rf11-signup-workspace-card li{
        display:flex;
        align-items:center;
        gap:5px;
        color:#686a74;
        font-size:6.5px;
      }

      .rf11-signup-workspace-card li svg{
        color:var(--rf11-signup-primary);
        flex:0 0 auto;
      }

      .rf11-signup-info-note,
      .rf11-signup-security-note{
        display:flex;
        align-items:flex-start;
        gap:8px;
        padding:10px;
        margin-top:11px;
        color:var(--rf11-signup-violet);
        background:linear-gradient(135deg,#f2ecff,#faf8ff);
        border:1px solid #e5dcf8;
        border-radius:8px;
      }

      .rf11-signup-info-note > span,
      .rf11-signup-security-note > span{
        width:30px;
        height:30px;
        display:grid;
        place-items:center;
        flex:0 0 30px;
        color:#6b38d4;
        background:#fff;
        border-radius:7px;
      }

      .rf11-signup-info-note > div,
      .rf11-signup-security-note > div{
        min-width:0;
      }

      .rf11-signup-info-note strong,
      .rf11-signup-security-note strong{
        display:block;
        color:#5325b8;
        font-size:7px;
      }

      .rf11-signup-info-note p,
      .rf11-signup-security-note p{
        margin:2px 0 0;
        color:var(--rf11-signup-text2);
        font-size:6.5px;
        line-height:11px;
      }

      .rf11-signup-single-action{
        display:flex;
        justify-content:flex-end;
        margin-top:13px;
      }

      .rf11-signup-single-action .rf11-auth-submit{
        width:auto!important;
        min-width:165px;
      }

      .rf11-signup-selected-workspace{
        min-height:57px;
        display:grid;
        grid-template-columns:33px minmax(0,1fr) auto;
        align-items:center;
        gap:8px;
        padding:9px;
        margin-bottom:13px;
        background:var(--rf11-signup-primary-soft);
        border:1px solid #d8d9ff;
        border-radius:8px;
      }

      .rf11-signup-selected-workspace > span{
        width:33px;
        height:33px;
        display:grid;
        place-items:center;
        color:var(--rf11-signup-primary);
        background:#fff;
        border-radius:8px;
      }

      .rf11-signup-selected-workspace > div{
        display:grid;
      }

      .rf11-signup-selected-workspace small{
        color:#7274ad;
        font-size:5.5px;
        text-transform:uppercase;
      }

      .rf11-signup-selected-workspace strong{
        color:#3436a5;
        font-size:8px;
      }

      .rf11-signup-selected-workspace > button{
        min-height:28px;
        padding:5px 7px;
        color:var(--rf11-signup-primary);
        background:#fff;
        border:1px solid #d9daf5;
        border-radius:6px;
        cursor:pointer;
        font-size:6px;
        font-weight:700;
      }

      .rf11-signup-details-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:11px;
      }

      .rf11-signup-field{
        min-width:0;
        display:grid;
        gap:5px;
      }

      .rf11-signup-field.wide{
        grid-column:1/-1;
      }

      .rf11-signup-field > span{
        color:var(--rf11-signup-text);
        font-size:7px;
        font-weight:700;
      }

      .rf11-signup-field > span em{
        margin-left:2px;
        color:var(--rf11-signup-danger);
        font-style:normal;
      }

      .rf11-signup-field > div{
        min-height:44px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:0 10px;
        color:#8a8b94;
        background:#fff;
        border:1px solid var(--rf11-signup-line);
        border-radius:8px;
        transition:
          border-color 140ms var(--rf11-signup-ease),
          box-shadow 140ms var(--rf11-signup-ease);
      }

      .rf11-signup-field > div:focus-within{
        border-color:var(--rf11-signup-line);
        box-shadow:none;
      }

      .rf11-signup-field > div > svg{
        flex:0 0 auto;
      }

      .rf11-signup-field input{
        min-width:0;
        width:100%;
        height:42px;
        padding:0;
        color:var(--rf11-signup-text);
        background:transparent;
        border:0;
        outline:0;
        font-size:9px;
      }

      .rf11-signup-field input::placeholder{
        color:#a3a4ac;
      }

      .rf11-signup-field input:disabled{
        cursor:not-allowed;
      }

      .rf11-signup-privacy-note{
        display:flex;
        align-items:flex-start;
        gap:7px;
        padding:9px 10px;
        margin-top:11px;
        color:var(--rf11-signup-primary);
        background:#f7f7fc;
        border-radius:8px;
      }

      .rf11-signup-privacy-note > svg{
        flex:0 0 auto;
        margin-top:1px;
      }

      .rf11-signup-privacy-note p{
        margin:0;
        color:var(--rf11-signup-text2);
        font-size:6.5px;
        line-height:11px;
      }

      .rf11-signup-form-actions{
        margin-top:13px!important;
      }

      .rf11-signup-form-actions .rf11-auth-back-btn{
        min-width:90px;
      }

      .rf11-signup-form-actions .rf11-auth-submit{
        min-width:170px!important;
      }

      .rf11-signup-account-form{
        display:grid;
      }

      .rf11-signup-account-summary{
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

      .rf11-signup-account-summary > span{
        width:37px;
        height:37px;
        display:grid;
        place-items:center;
        color:var(--rf11-signup-primary);
        background:#fff;
        border-radius:9px;
        box-shadow:0 1px 3px rgba(25,28,29,.04);
      }

      .rf11-signup-account-summary > div{
        min-width:0;
      }

      .rf11-signup-account-summary small{
        display:block;
        color:var(--rf11-signup-muted);
        font-size:5.5px;
        text-transform:uppercase;
      }

      .rf11-signup-account-summary strong{
        display:block;
        overflow:hidden;
        color:var(--rf11-signup-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:8px;
      }

      .rf11-signup-account-summary p{
        margin:1px 0 0;
        overflow:hidden;
        color:var(--rf11-signup-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6px;
      }

      .rf11-signup-google-block{
        display:grid;
        gap:10px;
        margin-bottom:14px;
      }

      .rf11-signup-google-block > div:first-child{
        width:100%;
      }

      .rf11-signup-or{
        display:grid;
        grid-template-columns:1fr auto 1fr;
        align-items:center;
        gap:9px;
      }

      .rf11-signup-or > span{
        height:1px;
        background:var(--rf11-signup-line);
      }

      .rf11-signup-or > b{
        color:var(--rf11-signup-muted);
        font-size:7px;
        font-weight:650;
      }

      .rf11-signup-starter-credit{
        min-height:34px;
        display:flex;
        align-items:center;
        gap:7px;
        padding:8px 10px;
        border:1px solid #d8dcf3;
        border-radius:9px;
        color:#4b4f61;
        background:#f7f7ff;
        font-size:8px;
        line-height:12px;
      }

      .rf11-signup-starter-credit svg{
        color:#6f63f6;
        flex:0 0 auto;
      }

      .rf11-signup-starter-credit strong{
        color:#4d47d7;
      }

      .rf11-signup-account-fields{
        display:grid;
        gap:11px;
      }

      .rf11-signup-password-toggle{
        min-width:38px;
        height:27px;
        padding:0 7px;
        color:var(--rf11-signup-primary);
        background:var(--rf11-signup-primary-soft);
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:6px;
        font-weight:750;
      }

      .rf11-signup-password-toggle:disabled{
        opacity:.45;
      }

      .rf11-signup-password-strength{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:9px;
        margin-top:-3px;
      }

      .rf11-signup-password-strength > div{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:4px;
        flex:1;
      }

      .rf11-signup-password-strength i{
        height:4px;
        display:block;
        background:#e6e7e9;
        border-radius:999px;
      }

      .rf11-signup-password-strength i.active{
        background:var(--rf11-signup-primary);
      }

      .rf11-signup-password-strength > span{
        min-width:85px;
        color:var(--rf11-signup-muted);
        text-align:right;
        font-size:6px;
      }

      .rf11-signup-security-note{
        color:var(--rf11-signup-primary);
        background:var(--rf11-signup-primary-soft);
        border-color:#dedfff;
      }

      .rf11-signup-security-note > span{
        color:var(--rf11-signup-primary);
      }

      .rf11-signup-security-note strong{
        color:#3739ac;
      }

      .rf11-signup-submit-caption{
        max-width:370px;
        margin:9px auto 0;
        color:var(--rf11-signup-muted);
        text-align:center;
        font-size:5.8px;
        line-height:9px;
      }

      .rf11-signup-spinner{
        width:12px;
        height:12px;
        display:block;
        border:2px solid currentColor;
        border-right-color:transparent;
        border-radius:50%;
        animation:rfsuSpin 700ms linear infinite;
      }

      .rf11-signup-v7 .rf11-auth-submit:focus-visible,
      .rf11-signup-workspace-card:focus-visible,
      .rf11-signup-password-toggle:focus-visible,
      .rf11-signup-selected-workspace > button:focus-visible,
      .rf11-signup-progress button:focus-visible{
        outline:3px solid rgba(70,72,212,.16);
        outline-offset:3px;
      }

      @media(max-width:620px){
        .rf11-signup-mobile-intro{
          display:block;
          margin-bottom:20px;
        }

        .rf11-signup-mobile-intro > span{
          display:inline-flex;
          align-items:center;
          gap:5px;
          color:var(--rf11-signup-primary);
          font-size:6px;
          font-weight:800;
          letter-spacing:.08em;
          text-transform:uppercase;
        }

        .rf11-signup-mobile-intro h1{
          margin:7px 0 0;
          font:600 27px/33px Geist,Inter,sans-serif;
          letter-spacing:-.03em;
        }

        .rf11-signup-mobile-intro p{
          margin:4px 0 0;
          color:var(--rf11-signup-text2);
          font-size:8px;
          line-height:13px;
        }

        .rf11-signup-progress{
          margin-bottom:17px;
        }

        .rf11-signup-progress-segment > button > b{
          display:none;
        }

        .rf11-signup-progress-segment > i{
          margin:0 6px;
        }

        .rf11-signup-card-head h2{
          font-size:21px!important;
          line-height:27px!important;
        }

        .rf11-signup-workspace-grid{
          grid-template-columns:1fr;
        }

        .rf11-signup-workspace-card{
          min-height:180px;
        }

        .rf11-signup-details-grid{
          grid-template-columns:1fr;
        }

        .rf11-signup-field.wide{
          grid-column:auto;
        }
      }

      @media(max-width:430px){
        .rf11-signup-single-action .rf11-auth-submit{
          width:100%!important;
        }

        .rf11-signup-form-actions{
          display:grid!important;
          grid-template-columns:1fr!important;
        }

        .rf11-signup-form-actions .rf11-auth-back-btn,
        .rf11-signup-form-actions .rf11-auth-submit{
          width:100%!important;
        }
      }



      /* V9 premium signup polish */
      .rf11-signup-v7 .rf11-signup-step-panel{will-change:transform,opacity,filter}
      .rf11-signup-v7 .rf11-signup-workspace-card{transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s ease,border-color .25s ease}
      .rf11-signup-v7 .rf11-signup-workspace-card:hover{transform:translateY(-5px);box-shadow:0 20px 46px rgba(27,31,41,.11)}
      .rf11-signup-v7 .rf11-auth-submit{position:relative;overflow:hidden;box-shadow:0 13px 32px rgba(70,72,212,.24)}
      .rf11-signup-v7 .rf11-auth-submit::after{content:"";position:absolute;inset:-2px auto -2px -38%;width:32%;transform:skewX(-20deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent);transition:left .55s ease}
      .rf11-signup-v7 .rf11-auth-submit:hover::after{left:112%}

            @media(prefers-reduced-motion:reduce){
        .rf11-signup-step-panel,
        .rf11-signup-alert,
        .rf11-signup-spinner{
          animation:none!important;
        }

        .rf11-signup-v7 *,
        .rf11-signup-v7 *::before,
        .rf11-signup-v7 *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}


function SignupV12ClarityStyles() {
  return <style>{`
/* ReachFly V12 — Signup clarity */
.rf11-signup-v7{--rf11-signup-text:#f8f9ff!important;--rf11-signup-text2:#b6bdd3!important;--rf11-signup-muted:#8f98b2!important;--rf11-signup-line:rgba(171,181,255,.16)!important;--rf11-signup-primary:#7868ff!important;--rf11-signup-primary-soft:rgba(120,104,255,.14)!important;color:#f7f8ff!important}
.rf11-signup-progress{margin-bottom:30px!important}.rf11-signup-progress-segment{color:#7f89a4!important;font-size:9px!important}.rf11-signup-progress-segment.active{color:#c4c0ff!important}.rf11-signup-progress-segment>span{background:rgba(255,255,255,.055)!important;border-color:rgba(255,255,255,.10)!important;color:#a1aac2!important}.rf11-signup-progress-segment.active>span{color:#fff!important;background:#7868ff!important;border-color:#7868ff!important}
.rf11-signup-step-panel{color:#f7f8ff!important}
.rf11-signup-workspace-grid{gap:14px!important}.rf11-signup-workspace-card{min-height:250px!important;padding:20px!important;color:#f7f8ff!important;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.025))!important;border:1px solid rgba(172,182,255,.16)!important;border-radius:16px!important;box-shadow:inset 0 1px rgba(255,255,255,.035)!important}.rf11-signup-workspace-card:hover{border-color:rgba(137,123,255,.52)!important;background:linear-gradient(145deg,rgba(120,104,255,.11),rgba(255,255,255,.035))!important;box-shadow:0 20px 46px rgba(0,0,0,.24)!important}.rf11-signup-workspace-card.active{background:linear-gradient(145deg,rgba(120,104,255,.18),rgba(74,205,255,.055))!important;border-color:#8778ff!important;box-shadow:0 0 0 1px rgba(135,120,255,.28),0 22px 54px rgba(60,45,160,.19)!important}
.rf11-signup-workspace-card>header>span{color:#c2bdff!important;background:rgba(120,104,255,.14)!important;border:1px solid rgba(149,138,255,.17)!important}.rf11-signup-workspace-card>div strong{color:#fff!important;font-size:14px!important;line-height:1.3!important}.rf11-signup-workspace-card>div p{color:#b3bad0!important;font-size:11px!important;line-height:1.55!important}.rf11-signup-workspace-card ul{border-color:rgba(255,255,255,.085)!important}.rf11-signup-workspace-card li{color:#a9b1c7!important;font-size:10px!important;line-height:1.4!important}
.rf11-signup-info-note,.rf11-signup-security-note,.rf11-signup-privacy-note,.rf11-signup-selected-workspace,.rf11-signup-account-summary{color:#d9dcf2!important;background:linear-gradient(135deg,rgba(120,104,255,.11),rgba(82,210,255,.04))!important;border:1px solid rgba(164,174,255,.14)!important;border-radius:12px!important}.rf11-signup-info-note>span,.rf11-signup-security-note>span,.rf11-signup-selected-workspace>span,.rf11-signup-account-summary>span{color:#c2bdff!important;background:rgba(255,255,255,.055)!important}.rf11-signup-info-note strong,.rf11-signup-security-note strong,.rf11-signup-selected-workspace strong,.rf11-signup-account-summary strong{color:#f3f4ff!important}.rf11-signup-info-note p,.rf11-signup-security-note p,.rf11-signup-privacy-note p,.rf11-signup-account-summary p{color:#aeb6ce!important;font-size:10px!important;line-height:1.5!important}.rf11-signup-selected-workspace small,.rf11-signup-account-summary small{color:#8f99b6!important}.rf11-signup-selected-workspace>button{color:#d6d1ff!important;background:rgba(255,255,255,.055)!important;border-color:rgba(255,255,255,.10)!important}
.rf11-signup-form-actions .rf11-auth-back-btn,.rf11-auth-back-btn{min-height:48px!important;color:#d6daea!important;background:rgba(255,255,255,.045)!important;border:1px solid rgba(255,255,255,.10)!important;border-radius:12px!important}
.rf11-signup-password-strength{color:#aab2c9!important}.rf11-signup-password-strength span{background:rgba(255,255,255,.08)!important}.rf11-signup-password-toggle{color:#d7d3ff!important;background:rgba(120,104,255,.14)!important}
.rf11-signup-privacy-note p,.rf11-signup-security-note p{font-size:10px!important}
@media(max-width:720px){.rf11-signup-workspace-grid,.rf11-signup-details-grid{grid-template-columns:1fr!important}.rf11-signup-workspace-card{min-height:0!important}.rf11-signup-single-action .rf11-auth-submit{width:100%!important}.rf11-signup-form-actions{display:grid!important;grid-template-columns:1fr!important}}
`}</style>;
}

function SignupContrastStyles() {
  return (
    <style>{`
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-v7{color:#172019!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-card-head h2{color:#111814!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-card-head p{color:#556159!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-card-eyebrow{color:#536159!important;background:#eef3ee!important;border:1px solid #dce5dd!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-progress-segment>button{color:#69766d!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-progress-segment>button>span{color:#5e6b62!important;background:#edf1ed!important;border:1px solid #d9e0da!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-progress-segment>button>b{color:#69766d!important;font-weight:700!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-progress-segment>button.active,.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-progress-segment>button.active>b{color:#6559e8!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-progress-segment>button.active>span{color:#fff!important;background:#6f63f6!important;border-color:#6f63f6!important;box-shadow:0 7px 18px rgba(111,99,246,.18)!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-progress-segment>i{background:#dce3dd!important}.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-progress-segment>i.complete{background:#aaa2fb!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-v7 .rf11-signup-workspace-card{min-height:230px!important;color:#172019!important;background:#f9fbf9!important;border:1px solid #cfd8d0!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 7px 22px rgba(31,47,35,.035)!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-v7 .rf11-signup-workspace-card:hover{color:#172019!important;background:#f5f8f5!important;border-color:#aebcaf!important;box-shadow:0 12px 30px rgba(30,46,34,.065)!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-v7 .rf11-signup-workspace-card.active{color:#172019!important;background:linear-gradient(180deg,#fafaff 0%,#f5f4ff 100%)!important;border-color:#786cf4!important;box-shadow:0 0 0 2px rgba(120,108,244,.08),0 12px 30px rgba(67,55,170,.075)!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-v7 .rf11-signup-workspace-card>header>span{color:#6659eb!important;background:#efedff!important;border:1px solid #ddd9ff!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-v7 .rf11-signup-workspace-card.active>header>span{color:#fff!important;background:#6f63f6!important;border-color:#6f63f6!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-v7 .rf11-signup-workspace-card>header>i{color:#fff!important;background:#6f63f6!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-v7 .rf11-signup-workspace-card>div strong{color:#172019!important;font-size:14px!important;line-height:1.35!important;font-weight:700!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-v7 .rf11-signup-workspace-card>div p{color:#56635a!important;font-size:11px!important;line-height:1.55!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-v7 .rf11-signup-workspace-card ul{border-color:#dde4de!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-v7 .rf11-signup-workspace-card li{color:#657168!important;font-size:10px!important;line-height:1.45!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-v7 .rf11-signup-workspace-card li svg{color:#7669f3!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-info-note,.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-security-note,.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-privacy-note{color:#334139!important;background:#f3f6f2!important;border:1px solid #d8e0d9!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-info-note>span,.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-security-note>span{color:#6358e4!important;background:#eceaff!important;border:1px solid #ddd9ff!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-info-note strong,.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-security-note strong{color:#28352d!important;font-weight:700!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-info-note p,.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-security-note p,.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-privacy-note p{color:#5c685f!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-selected-workspace,.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-account-summary{color:#26332a!important;background:#f4f6ff!important;border:1px solid #d8dcf3!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-selected-workspace small,.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-account-summary small{color:#68746c!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-selected-workspace strong,.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-account-summary strong{color:#28352d!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-field>span{color:#2b382f!important;font-weight:700!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-field>div{min-height:56px!important;color:#637067!important;background:#f6f8f5!important;border:1px solid #cbd5cc!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 5px 16px rgba(32,48,36,.03)!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-field>div:hover{background:#f3f6f2!important;border-color:#b8c6ba!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-field>div:focus-within{color:#31463a!important;background:#fff!important;border-color:#cbd5cc!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 5px 16px rgba(32,48,36,.03)!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-field>div>svg{color:#66746a!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-field input{color:#172019!important;background:transparent!important;caret-color:#1c2e1e!important;font-size:14px!important;font-weight:550!important;opacity:1!important;-webkit-text-fill-color:#172019!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-field input::placeholder{color:#748077!important;opacity:1!important;font-weight:500!important;-webkit-text-fill-color:#748077!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-field input:disabled{color:#66736a!important;-webkit-text-fill-color:#66736a!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-password-toggle{color:#304136!important;background:#edf2ed!important;border:1px solid #d3ddd5!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-submit{color:#fff!important;background:#1c2e1e!important;border-color:#1c2e1e!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-submit:disabled{color:#6f7b72!important;-webkit-text-fill-color:#6f7b72!important;background:#e7ece7!important;border-color:#d9e0da!important;box-shadow:none!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-auth-back-btn{color:#33443a!important;background:#f6f8f5!important;border-color:#ccd6ce!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-alert{color:#7c2d31!important;background:#fff4f4!important;border-color:#eccdce!important}.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-alert strong{color:#672226!important}.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-alert p{color:#7d3d40!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-submit-caption,.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-password-strength span{color:#68756c!important;opacity:1!important}
      .rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-password-strength i{background:#d8dfd9!important}.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-password-strength i.active{background:#6f63f6!important}
      @media(max-width:720px){.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-v7 .rf11-signup-workspace-card{min-height:0!important}.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-field>div{min-height:54px!important}.rf15-auth-page.rf16-auth-page .rf16-auth-panel .rf11-signup-field input{font-size:15px!important}}
    `}</style>
  );
}

