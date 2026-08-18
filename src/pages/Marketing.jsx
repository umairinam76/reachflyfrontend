import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles as ThreeSparkles } from "@react-three/drei";
import BrandLogo from "../components/BrandLogo";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Brain,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Globe2,
  Mail,
  MapPinned,
  Menu,
  MessageCircle,
  Phone,
  Shield,
  Sparkles,
  Target,
  Users,
  Workflow,
  X,
  Zap,
} from "../components/icons";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/*
 * Add only customers that have approved public logo/name usage.
 * Keeping this empty is intentional: the page falls back to a truthful
 * audience strip instead of inventing customer logos or social-proof claims.
 *
 * Example:
 * { name: "Acme", logo: "/customers/acme.svg" }
 */
const APPROVED_CUSTOMERS = [];

const AUDIENCE_LABELS = [
  "Agencies",
  "B2B SaaS",
  "Growth teams",
  "Local sales",
  "Founders",
];

const PAIN_POINTS = [
  {
    icon: Target,
    title: "Prospecting stops at a list",
    text: "You can find hundreds of businesses and still spend hours researching which ones are worth contacting and why.",
  },
  {
    icon: Bot,
    title: "AI callers lack context",
    text: "A voice agent with only a name and phone number sounds generic because it does not know the business or the reason for the call.",
  },
  {
    icon: Mail,
    title: "Follow-up gets disconnected",
    text: "Calls, emails, callbacks, meetings, and notes drift into separate tools, forcing the team to rebuild context after every touch.",
  },
  {
    icon: BarChart3,
    title: "Managers lose the full picture",
    text: "Activity is happening, but it becomes difficult to see what moved from discovery to conversation, meeting, and pipeline action.",
  },
];

const JOURNEY = [
  {
    number: "01",
    icon: MapPinned,
    eyebrow: "Find the market",
    title: "Tell ReachFly who you want to sell to.",
    text: "Choose a niche, geography, territory, or business type and turn that market into structured prospect records your team can work.",
    detail: "Lead discovery · niche + location · territory context",
  },
  {
    number: "02",
    icon: Brain,
    eyebrow: "Understand the opportunity",
    title: "Know why the prospect may care before you contact them.",
    text: "Add website and business context to the lead so outreach starts with a reason instead of a generic introduction.",
    detail: "Website intelligence · opportunity context · audit signals",
  },
  {
    number: "03",
    icon: Phone,
    eyebrow: "Start the conversation",
    title: "Give your AI Voice Agent more than a phone number.",
    text: "The agent can work from lead context, campaign intent, and sales instructions before the conversation begins.",
    detail: "Lead context · campaign objective · AI Voice",
  },
  {
    number: "04",
    icon: MessageCircle,
    eyebrow: "Capture what happened",
    title: "Turn every conversation into structured sales context.",
    text: "Keep outcomes, notes, qualification, callbacks, objections, and meeting intent attached to the same prospect record.",
    detail: "Outcome · notes · callbacks · qualification",
  },
  {
    number: "05",
    icon: Mail,
    eyebrow: "Follow up intelligently",
    title: "Continue the conversation instead of starting over.",
    text: "Use the context already captured to coordinate email follow-up and the next action without rebuilding the prospect story.",
    detail: "Email · inbox · next action · shared context",
  },
  {
    number: "06",
    icon: Calendar,
    eyebrow: "Move the opportunity forward",
    title: "From first market signal to booked meeting and pipeline.",
    text: "Keep meeting status, ownership, lead stage, and team activity connected so the next step is always visible.",
    detail: "Meetings · ownership · pipeline · team activity",
  },
];

const USE_CASES = [
  {
    icon: Building2,
    label: "Agencies",
    title: "Turn local businesses into qualified opportunities.",
    text: "Find businesses in a niche, add audit context, start relevant conversations, and keep booked meetings connected to the same prospect record.",
    points: ["Web & development agencies", "SEO & marketing agencies", "Lead-generation teams"],
    href: "/local-lead-generation-tool",
  },
  {
    icon: Zap,
    label: "B2B SaaS",
    title: "Give outbound more context before the first touch.",
    text: "Build targeted account lists, understand the account, run AI-assisted outreach, and keep each response tied to your sales process.",
    points: ["Targeted account discovery", "Context-led outreach", "Pipeline continuity"],
    href: "/ai-lead-generation-crm",
  },
  {
    icon: MapPinned,
    label: "Local sales",
    title: "Prospect an entire market without living in spreadsheets.",
    text: "Organize businesses by category and geography, work territories systematically, and keep follow-up attached to the opportunity.",
    points: ["Niche + location research", "Territory workflow", "Repeatable follow-up"],
    href: "/local-lead-generation-tool",
  },
  {
    icon: Users,
    label: "Sales teams",
    title: "One operating system from prospecting through follow-up.",
    text: "Managers keep visibility while callers and reps get the lead context, history, and next action they need to keep momentum.",
    points: ["Role-based access", "Shared lead context", "Visible outcomes"],
    href: "/auto-reach-crm",
  },
  {
    icon: Sparkles,
    label: "Founders",
    title: "Build pipeline without assembling six disconnected tools.",
    text: "Use one workspace for prospect discovery, opportunity context, AI conversations, follow-up, meetings, and pipeline activity.",
    points: ["Fewer handoffs", "Clearer context", "Usage-based start"],
    href: "/ai-marketing-software",
  },
];

const AGENTS = [
  {
    icon: MapPinned,
    label: "Scout",
    title: "Prospecting Agent",
    text: "Finds opportunities inside the market, niche, and territory your team chooses.",
  },
  {
    icon: Brain,
    label: "Context",
    title: "Audit Agent",
    text: "Turns public website and business signals into practical sales context before outreach.",
  },
  {
    icon: Phone,
    label: "Conversation",
    title: "Voice Agent",
    text: "Starts AI-assisted sales conversations with lead context, outcomes, and meeting support.",
  },
  {
    icon: Mail,
    label: "Follow-up",
    title: "Follow-up Agent",
    text: "Uses lead, audit, and conversation context to keep the next touch relevant.",
  },
  {
    icon: Workflow,
    label: "Operations",
    title: "Pipeline Agent",
    text: "Keeps assignments, next actions, and follow-up connected to the prospect record.",
  },
];

const TRUST_CONTROLS = [
  {
    icon: Users,
    title: "Role-based workspace",
    text: "Keep access aligned to owners, admins, managers, callers, and other permitted users.",
  },
  {
    icon: BarChart3,
    title: "Usage visibility",
    text: "Keep credit balances, activity, and supported usage visible inside the workspace.",
  },
  {
    icon: MessageCircle,
    title: "Conversation history",
    text: "Keep call outcomes and follow-up context attached to the prospect instead of scattered across tools.",
  },
  {
    icon: Shield,
    title: "Human oversight",
    text: "Configure agent behavior, review activity, and keep important workflow decisions visible to the team.",
  },
  {
    icon: Phone,
    title: "Connected business calling",
    text: "Keep AI Voice operations associated with a workspace, number readiness, and the lead being contacted.",
  },
  {
    icon: Workflow,
    title: "Controlled follow-up",
    text: "Calls, callbacks, emails, meetings, owners, and next actions remain visible in the operating flow.",
  },
];

const FAQ = [
  {
    question: "Is ReachFly just a lead scraper?",
    answer:
      "No. Lead discovery is the beginning of the workflow. ReachFly is designed to keep discovery, business context, AI Voice, email follow-up, meetings, pipeline activity, and team operations connected around the same prospect.",
  },
  {
    question: "How does the AI Voice Agent know what to say?",
    answer:
      "The Voice Agent can work from lead and company context, campaign intent, agent instructions, and the information your workspace makes available to the calling workflow.",
  },
  {
    question: "What happens after a prospect answers?",
    answer:
      "The goal is to keep the outcome connected. Qualification, notes, callbacks, meeting intent, and follow-up can remain attached to the same sales record instead of becoming another disconnected task.",
  },
  {
    question: "Can ReachFly support agencies and local-business prospecting?",
    answer:
      "Yes. ReachFly is particularly useful when a team needs to define a niche or location, discover relevant businesses, understand the opportunity, start outreach, and keep the next action organized.",
  },
  {
    question: "Can a team work in the same ReachFly workspace?",
    answer:
      "Yes. ReachFly uses workspace roles so different team members can operate with access appropriate to their responsibilities while keeping activity connected to the shared sales workflow.",
  },
  {
    question: "How is ReachFly usage billed?",
    answer:
      "ReachFly uses prepaid usage balances for supported product activity, with calling separated into its own call-credit wallet so voice usage remains visible independently from general workspace usage.",
  },
];

export default function Marketing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const rootRef = useRef(null);
  const sceneProgressRef = useRef(0);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progressScale = useSpring(scrollYProgress, { stiffness: 110, damping: 24, mass: 0.25 });
  const atmosphereY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);

  useEffect(() => {
    if (reduceMotion || typeof window === "undefined") return undefined;

    const lenis = new Lenis({
      autoRaf: false,
      duration: 1.08,
      smoothWheel: true,
      anchors: { offset: -82 },
    });

    lenis.on("scroll", ScrollTrigger.update);

    const update = (time) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(update);
      lenis.destroy();
    };
  }, [reduceMotion]);

  useGSAP(
    () => {
      if (reduceMotion) return undefined;

      const mm = gsap.matchMedia();

      ScrollTrigger.create({
        trigger: rootRef.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          sceneProgressRef.current = self.progress;
        },
      });

      mm.add("(min-width: 901px)", () => {
        const heroTimeline = gsap.timeline({ defaults: { ease: "power3.out" } });

        heroTimeline
          .from(".rfm-hero-copy > *", {
            opacity: 0,
            y: 26,
            duration: 0.78,
            stagger: 0.075,
          })
          .from(
            ".rfm-hero-preview-wrap",
            {
              opacity: 0,
              y: 54,
              rotateX: 8,
              rotateY: -7,
              scale: 0.965,
              transformOrigin: "50% 50%",
              duration: 1.08,
            },
            "-=0.7"
          );

        const heroScene = gsap.timeline({
          scrollTrigger: {
            trigger: ".rfm-hero",
            start: "top top",
            end: "+=85%",
            scrub: 1,
            pin: true,
            anticipatePin: 1,
          },
        });

        heroScene
          .to(".rfm-hero-copy", { yPercent: -10, opacity: 0.32, ease: "none" }, 0)
          .to(".rfm-hero-preview-wrap", {
            xPercent: -8,
            yPercent: -8,
            scale: 1.08,
            rotateY: 7,
            rotateX: -3,
            ease: "none",
          }, 0)
          .to(".rfm-hero-3d", { scale: 1.22, opacity: 1, ease: "none" }, 0)
          .to(".rfm-scroll-cue", { opacity: 0, y: 18, ease: "none" }, 0);

        let removeHeroPointer = () => {};
        const hero = rootRef.current?.querySelector(".rfm-hero");
        const previewWrap = rootRef.current?.querySelector(".rfm-hero-preview-wrap");
        if (hero && previewWrap) {
          const rotateYTo = gsap.quickTo(previewWrap, "--rfm-pointer-ry", { duration: 0.55, ease: "power3.out" });
          const rotateXTo = gsap.quickTo(previewWrap, "--rfm-pointer-rx", { duration: 0.55, ease: "power3.out" });
          const onPointerMove = (event) => {
            const rect = hero.getBoundingClientRect();
            const nx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
            const ny = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
            rotateYTo(nx * 4.5);
            rotateXTo(ny * -3.2);
          };
          const onPointerLeave = () => {
            rotateYTo(0);
            rotateXTo(0);
          };
          hero.addEventListener("pointermove", onPointerMove);
          hero.addEventListener("pointerleave", onPointerLeave);
          removeHeroPointer = () => {
            hero.removeEventListener("pointermove", onPointerMove);
            hero.removeEventListener("pointerleave", onPointerLeave);
          };
        }

        gsap.to(".rfm-product-preview", {
          yPercent: -5,
          rotateX: 1.5,
          ease: "none",
          scrollTrigger: {
            trigger: ".rfm-hero",
            start: "top top",
            end: "bottom top",
            scrub: 0.8,
          },
        });

        gsap.to(".rfm-hero-glow-one", {
          xPercent: 35,
          yPercent: 30,
          ease: "none",
          scrollTrigger: { trigger: ".rfm-hero", start: "top top", end: "bottom top", scrub: 1.2 },
        });

        gsap.to(".rfm-hero-glow-two", {
          xPercent: -26,
          yPercent: -20,
          ease: "none",
          scrollTrigger: { trigger: ".rfm-hero", start: "top top", end: "bottom top", scrub: 1.2 },
        });

        const stackTimeline = gsap.timeline({
          scrollTrigger: {
            trigger: ".rfm-stack-section",
            start: "top top",
            end: "+=115%",
            scrub: 1,
            pin: true,
            anticipatePin: 1,
          },
        });

        stackTimeline
          .fromTo(".rfm-stack-fragmented > div > span",
            { x: 0, y: 0, rotate: 0, opacity: 1 },
            {
              x: (index) => (index % 2 ? 110 : -110),
              y: (index) => (index - 3.5) * 12,
              rotate: (index) => (index % 2 ? 7 : -7),
              opacity: 0.08,
              stagger: 0.025,
              ease: "none",
            }, 0)
          .fromTo(".rfm-stack-reachfly",
            { scale: 0.86, rotateY: -8, opacity: 0.42 },
            { scale: 1.04, rotateY: 0, opacity: 1, ease: "none" }, 0.05)
          .fromTo(".rfm-stack-path > span",
            { y: 24, opacity: 0 },
            { y: 0, opacity: 1, stagger: 0.055, ease: "none" }, 0.28);

        const usecaseTrack = rootRef.current?.querySelector(".rfm-usecase-grid");
        if (usecaseTrack) {
          gsap.to(usecaseTrack, {
            x: () => -Math.max(0, usecaseTrack.scrollWidth - window.innerWidth + 120),
            ease: "none",
            scrollTrigger: {
              trigger: ".rfm-usecase-section",
              start: "top top",
              end: () => `+=${Math.max(window.innerWidth, usecaseTrack.scrollWidth * 0.72)}`,
              pin: true,
              scrub: 1,
              invalidateOnRefresh: true,
              anticipatePin: 1,
            },
          });
        }

        gsap.utils.toArray(".rfm-journey > article").forEach((card, index) => {
          gsap.fromTo(
            card,
            { opacity: 0.7, scale: 0.975 },
            {
              opacity: 1,
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: card,
                start: "top 72%",
                end: "top 28%",
                scrub: 0.6,
              },
            }
          );

          const visual = card.querySelector(".rfm-journey-visual");
          if (visual) {
            gsap.fromTo(
              visual,
              { y: 34, rotateY: index % 2 ? -2 : 2 },
              {
                y: -24,
                rotateY: 0,
                ease: "none",
                scrollTrigger: {
                  trigger: card,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 1,
                },
              }
            );
          }
        });
        return removeHeroPointer;
      });

      gsap.utils
        .toArray(
          ".rfm-section-head, .rfm-problem-grid, .rfm-stack-compare, .rfm-usecase-grid, .rfm-voice-copy, .rfm-voice-demo-wrap, .rfm-agent-grid, .rfm-trust-grid, .rfm-pricing-grid, .rfm-faq-list, .rfm-final"
        )
        .forEach((element) => {
          gsap.from(element, {
            opacity: 0,
            y: 34,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: {
              trigger: element,
              start: "top 86%",
              once: true,
            },
          });
        });

      return () => mm.revert();
    },
    { scope: rootRef, dependencies: [reduceMotion], revertOnUpdate: true }
  );

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    const handleResize = () => {
      if (window.innerWidth > 900) {
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [mobileOpen]);

  return (
    <>
      <MarketingStyles />

      <main className="rf-marketing-v8" ref={rootRef}>
        <motion.div className="rfm-scroll-progress" style={{ scaleX: progressScale }} aria-hidden="true" />
        <motion.div className="rfm-atmosphere" style={{ y: atmosphereY }} aria-hidden="true">
          <span className="rfm-atmosphere-grid" />
          <span className="rfm-atmosphere-orb rfm-atmosphere-orb-a" />
          <span className="rfm-atmosphere-orb rfm-atmosphere-orb-b" />
          <span className="rfm-atmosphere-noise" />
        </motion.div>
        <header className="rfm-nav">
          <Link className="rfm-brand" to="/" aria-label="ReachFly home">
            <span>
              <BrandLogo size={38} />
            </span>

            <div>
              <strong>ReachFly</strong>
              <small>Sales OS</small>
            </div>
          </Link>

          <nav className="rfm-desktop-nav" aria-label="Primary navigation">
            <a href="#why">Why ReachFly</a>
            <a href="#how">How it works</a>
            <a href="#use-cases">Use cases</a>
            <a href="#voice">AI Voice</a>
            <a href="#trust">Trust</a>
            <a href="#pricing">Pricing</a>
          </nav>

          <div className="rfm-nav-actions">
            <Link className="rfm-btn secondary" to="/login">
              Sign in
            </Link>

            <Link className="rfm-btn primary" to="/signup">
              Get started
              <ArrowRight size={14} />
            </Link>

            <button
              type="button"
              className="rfm-menu-btn"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </button>
          </div>
        </header>

        {mobileOpen ? (
          <div
            className="rfm-mobile-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setMobileOpen(false);
              }
            }}
          >
            <aside className="rfm-mobile-menu" aria-label="Mobile navigation">
              <header>
                <Link className="rfm-brand" to="/" onClick={() => setMobileOpen(false)}>
                  <span>
                    <BrandLogo size={34} />
                  </span>
                  <div>
                    <strong>ReachFly</strong>
                    <small>Sales OS</small>
                  </div>
                </Link>

                <button
                  type="button"
                  aria-label="Close navigation"
                  onClick={() => setMobileOpen(false)}
                >
                  <X size={17} />
                </button>
              </header>

              <nav>
                {[
                  ["#why", "Why ReachFly"],
                  ["#how", "How it works"],
                  ["#use-cases", "Use cases"],
                  ["#voice", "AI Voice"],
                  ["#trust", "Trust"],
                  ["#pricing", "Pricing"],
                ].map(([href, label]) => (
                  <a key={href} href={href} onClick={() => setMobileOpen(false)}>
                    {label}
                    <ChevronRight size={14} />
                  </a>
                ))}
              </nav>

              <div className="rfm-mobile-actions">
                <Link className="rfm-btn secondary" to="/login">
                  Sign in
                </Link>
                <Link className="rfm-btn primary" to="/signup">
                  Create workspace
                  <ArrowRight size={14} />
                </Link>
              </div>
            </aside>
          </div>
        ) : null}

        <section className="rfm-hero">
          <div className="rfm-hero-3d" aria-hidden="true">
            <ReachFlyThreeScene progressRef={sceneProgressRef} reduceMotion={reduceMotion} />
          </div>
          <div className="rfm-hero-grid" />
          <div className="rfm-hero-glow rfm-hero-glow-one" />
          <div className="rfm-hero-glow rfm-hero-glow-two" />

          <motion.div
            className="rfm-hero-copy"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="rfm-kicker">
              <Sparkles size={14} />
              AI sales workspace · prospect to conversation
            </span>

            <h1>
              Turn the right businesses into <em>real sales conversations.</em>
            </h1>

            <p>
              ReachFly discovers prospects, adds business context, gives AI Voice the information
              needed for a relevant conversation, keeps follow-up connected, and moves qualified
              opportunities toward meetings and pipeline — from one sales workspace.
            </p>

            <div className="rfm-hero-actions">
              <Link className="rfm-btn primary large" to="/signup">
                Start finding prospects
                <ArrowRight size={17} />
              </Link>

              <a className="rfm-btn ghost large" href="#how">
                See how ReachFly works
              </a>
            </div>

            <div className="rfm-proof" aria-label="ReachFly product principles">
              <span>
                <Check size={13} />
                One connected lead timeline
              </span>
              <span>
                <Check size={13} />
                AI Voice + business context
              </span>
              <span>
                <Check size={13} />
                Prepaid usage visibility
              </span>
            </div>
          </motion.div>

          <div className="rfm-hero-preview-wrap">
            <ProductPreview />
            <motion.div
              className="rfm-float-signal signal-a"
              animate={reduceMotion ? undefined : { y: [0, -14, 0], rotate: [-1, 1.5, -1] }}
              transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden="true"
            >
              <span><Brain size={14} /></span><div><small>Context ready</small><strong>39 prospects</strong></div>
            </motion.div>
            <motion.div
              className="rfm-float-signal signal-b"
              animate={reduceMotion ? undefined : { y: [0, 12, 0], x: [0, -6, 0] }}
              transition={{ duration: 6.4, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden="true"
            >
              <span><Phone size={14} /></span><div><small>AI Voice</small><strong>Conversation live</strong></div>
            </motion.div>
            <motion.div
              className="rfm-float-signal signal-c"
              animate={reduceMotion ? undefined : { y: [0, -9, 0], rotate: [1, -1, 1] }}
              transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden="true"
            >
              <span><Calendar size={14} /></span><div><small>Outcome</small><strong>Meeting booked</strong></div>
            </motion.div>
            <span className="rfm-preview-caption">Illustrative ReachFly workspace preview</span>
          </div>

          <a className="rfm-scroll-cue" href="#why" aria-label="Scroll to discover ReachFly">
            <span>Scroll to discover</span>
            <i><ArrowRight size={13} /></i>
          </a>
        </section>

        <section className="rfm-trusted-section" aria-label="ReachFly trust and audience">
          <div className="rfm-trusted-copy">
            <span>{APPROVED_CUSTOMERS.length ? "Trusted by teams at" : "Built for modern revenue teams"}</span>
            <strong>
              {APPROVED_CUSTOMERS.length
                ? "Teams use ReachFly to keep the outbound workflow connected."
                : "A trust-first sales workflow for teams that need pipeline, not another disconnected dashboard."}
            </strong>
          </div>

          {APPROVED_CUSTOMERS.length ? (
            <div className="rfm-customer-logos">
              {APPROVED_CUSTOMERS.map((customer) => (
                <div key={customer.name} className="rfm-customer-logo">
                  {customer.logo ? <img src={customer.logo} alt={customer.name} /> : customer.name}
                </div>
              ))}
            </div>
          ) : (
            <div className="rfm-audience-marquee" aria-label="Teams ReachFly is built for">
              <motion.div
                className="rfm-audience-marquee-track"
                animate={reduceMotion ? undefined : { x: ["0%", "-50%"] }}
                transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
              >
                {[...AUDIENCE_LABELS, ...AUDIENCE_LABELS, ...AUDIENCE_LABELS, ...AUDIENCE_LABELS].map((label, index) => (
                  <span key={`${label}-${index}`}>{label}<i /></span>
                ))}
              </motion.div>
            </div>
          )}
        </section>

        <section id="why" className="rfm-section rfm-problem-section">
          <SectionHeading
            eyebrow="Why ReachFly"
            title="Your sales stack knows pieces of the prospect. Nobody knows the whole story."
            text="The problem is not a shortage of tools. It is the context that disappears between discovery, research, calling, follow-up, meetings, and pipeline activity."
          />

          <div className="rfm-problem-grid">
            {PAIN_POINTS.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article
                  key={item.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <span>
                    <Icon size={20} />
                  </span>
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </motion.article>
              );
            })}
          </div>

          <div className="rfm-bridge-callout">
            <div>
              <span className="rfm-eyebrow">The ReachFly idea</span>
              <h3>Keep the prospect, the reason, the conversation, and the next action connected.</h3>
            </div>
            <div className="rfm-bridge-flow" aria-label="ReachFly sales flow">
              {["Discover", "Context", "AI Voice", "Follow-up", "Meet", "Pipeline"].map((step, index, arr) => (
                <span key={step}>
                  <b>{step}</b>
                  {index < arr.length - 1 ? <ArrowRight size={13} /> : null}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="rfm-stack-section">
          <div className="rfm-section rfm-stack-inner">
            <SectionHeading
              eyebrow="One workspace instead of a fragmented stack"
              title="What normally requires a stack becomes one connected sales motion."
              text="ReachFly is built around the prospect record, so the workflow can move forward without reconstructing context in every tool."
              light
            />

            <div className="rfm-stack-compare">
              <article className="rfm-stack-fragmented">
                <header>
                  <span>Traditional outbound stack</span>
                  <strong>Eight tools. Eight versions of the truth.</strong>
                </header>
                <div>
                  {[
                    [Target, "Lead database"],
                    [MapPinned, "Prospecting tool"],
                    [Brain, "Website analyzer"],
                    [Phone, "AI dialer"],
                    [Mail, "Email tool"],
                    [Calendar, "Calendar"],
                    [Workflow, "CRM"],
                    [Users, "Team dashboard"],
                  ].map(([Icon, label]) => (
                    <span key={label}>
                      <Icon size={15} />
                      {label}
                    </span>
                  ))}
                </div>
                <p>Context gets copied, exported, re-entered, and lost between systems.</p>
              </article>

              <article className="rfm-stack-reachfly">
                <header>
                  <span className="rfm-mini-logo">
                    <BrandLogo size={28} />
                  </span>
                  <div>
                    <small>ReachFly</small>
                    <strong>One prospect. One context. One timeline.</strong>
                  </div>
                </header>

                <div className="rfm-stack-path">
                  {[Target, Brain, Phone, Mail, Calendar, Workflow].map((Icon, index) => {
                    const labels = ["Discover", "Understand", "Call", "Follow up", "Meet", "Pipeline"];
                    return (
                      <span key={labels[index]}>
                        <i>
                          <Icon size={16} />
                        </i>
                        <b>{labels[index]}</b>
                        {index < labels.length - 1 ? <ArrowRight size={12} /> : null}
                      </span>
                    );
                  })}
                </div>

                <div className="rfm-stack-result">
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>The next action inherits the context from the last one.</strong>
                    <span>No separate prospect story to rebuild.</span>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="how" className="rfm-section rfm-journey-section">
          <SectionHeading
            eyebrow="From market to meeting"
            title="Every section of ReachFly exists to move one sales story forward."
            text="Start with a market, build a reason to contact the business, start the conversation, capture what happened, and keep the opportunity moving."
          />

          <div className="rfm-journey">
            {JOURNEY.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.article
                  key={step.number}
                  className={index % 2 ? "reverse" : ""}
                  style={{ "--rfm-story-index": index }}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.18 }}
                >
                  <div className="rfm-journey-index">
                    <span>{step.number}</span>
                    <i>
                      <Icon size={22} />
                    </i>
                  </div>

                  <div className="rfm-journey-copy">
                    <small>{step.eyebrow}</small>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                    <em>{step.detail}</em>
                  </div>

                  <JourneyVisual step={step.number} />
                </motion.article>
              );
            })}
          </div>
        </section>

        <section id="use-cases" className="rfm-usecase-section">
          <div className="rfm-section">
            <SectionHeading
              eyebrow="Built for your sales motion"
              title="ReachFly becomes easier to understand when you see your own workflow inside it."
              text="Different teams start from different markets, but the operating need is similar: find the right business, know why it matters, start a relevant conversation, and preserve the next step."
            />

            <div className="rfm-usecase-grid">
              {USE_CASES.map((item, index) => {
                const Icon = item.icon;
                return (
                  <article key={item.label} className={index === 0 ? "featured" : ""}>
                    <header>
                      <span>
                        <Icon size={20} />
                      </span>
                      <small>{item.label}</small>
                    </header>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                    <ul>
                      {item.points.map((point) => (
                        <li key={point}>
                          <Check size={13} />
                          {point}
                        </li>
                      ))}
                    </ul>
                    <Link to={item.href}>
                      Explore this use case
                      <ArrowRight size={14} />
                    </Link>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="voice" className="rfm-voice-chapter">
          <div className="rfm-section rfm-voice-section">
            <div className="rfm-voice-copy">
              <span className="rfm-kicker">
                <Phone size={14} />
                AI Voice with sales context
              </span>

              <h2>Not an AI dialer. A sales agent that already knows the lead.</h2>

              <p>
                A better AI conversation starts before the phone rings. ReachFly keeps the business,
                prospect context, campaign intent, and follow-up workflow close to the call so the
                conversation has somewhere useful to go next.
              </p>

              <div className="rfm-voice-points">
                {[
                  "Lead and company context before the call",
                  "Campaign objective and agent instructions",
                  "Call outcome and qualification captured afterward",
                  "Callback and meeting intent attached to the lead",
                  "Follow-up continues from the same context",
                ].map((item) => (
                  <span key={item}>
                    <CheckCircle2 size={15} />
                    {item}
                  </span>
                ))}
              </div>

              <Link className="rfm-inline-cta" to="/signup">
                Build your AI Voice workflow
                <ArrowRight size={15} />
              </Link>
            </div>

            <div className="rfm-voice-demo-wrap">
              <VoicePreview />
              <div className="rfm-voice-context-card">
                <span>
                  <Brain size={15} />
                  Context available to the workflow
                </span>
                <div>
                  <b>Business</b>
                  <p>Nova Dental · local practice</p>
                </div>
                <div>
                  <b>Opportunity</b>
                  <p>Booking journey has conversion friction</p>
                </div>
                <div>
                  <b>Next step</b>
                  <p>Send audit + suggest a meeting</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rfm-section rfm-agents-section">
          <SectionHeading
            eyebrow="Specialist AI workforce"
            title="Your sales workflow should not depend on one generic AI."
            text="ReachFly's AI experiences are organized around distinct jobs in the sales process, while the workspace keeps their context connected."
          />

          <div className="rfm-agent-grid">
            {AGENTS.map((item, index) => {
              const Icon = item.icon;
              return (
                <article key={item.title}>
                  <header>
                    <span>
                      <Icon size={19} />
                    </span>
                    <em>0{index + 1}</em>
                  </header>
                  <small>{item.label}</small>
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>

          <div className="rfm-agent-linkage">
            <span>
              <Workflow size={18} />
            </span>
            <div>
              <strong>They do not operate in isolation.</strong>
              <p>The lead record is the connective tissue between discovery, context, conversation, follow-up, and pipeline work.</p>
            </div>
          </div>
        </section>

        <section id="trust" className="rfm-trust-chapter">
          <div className="rfm-section">
            <div className="rfm-trust-head">
              <div>
                <span className="rfm-eyebrow">Trust & control</span>
                <h2>AI automation without losing visibility or ownership.</h2>
                <p>
                  Trust is not a logo strip alone. It is also knowing who can operate the workspace,
                  what happened with a lead, where usage is going, and what the next action is.
                </p>
              </div>
              <div className="rfm-trust-seal">
                <Shield size={28} />
                <strong>Built around visible sales operations</strong>
                <span>Workspace · activity · outcomes · next actions</span>
              </div>
            </div>

            <div className="rfm-trust-grid">
              {TRUST_CONTROLS.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title}>
                    <span>
                      <Icon size={18} />
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.text}</p>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="rfm-trust-note">
              <CheckCircle2 size={17} />
              <p>
                Customer logos, testimonials, and performance metrics should be added here only after
                they are approved and verifiable. The component already supports an approved customer list at the top of this file.
              </p>
            </div>
          </div>
        </section>

        <section id="pricing" className="rfm-section rfm-pricing-section">
          <SectionHeading
            eyebrow="Usage-based pricing"
            title="Start with the sales activity you need, then scale what works."
            text="ReachFly uses prepaid usage balances so supported product activity stays visible instead of hiding every cost behind a large plan commitment."
          />

          <div className="rfm-pricing-grid">
            <PricingCard
              icon={Zap}
              title="ReachFly Credits"
              text="General workspace credits cover supported actions such as lead discovery, audits, and AI-assisted workflows according to the live rate card."
              points={["Prepaid workspace balance", "Usage and ledger visibility", "Server-published feature rates"]}
              action="Create workspace"
            />

            <PricingCard
              icon={Phone}
              title="AI Call Credits"
              text="Calling uses its own credit wallet so voice usage stays visible and separate from general ReachFly product credits."
              points={["Separate calling wallet", "Connected-call usage history", "Business-number readiness"]}
              featured
              action="Start AI Voice"
            />

            <PricingCard
              icon={Building2}
              title="Business Number"
              text="Connect or purchase an approved business number as part of AI Voice onboarding and keep its workspace status visible."
              points={["Workspace-scoped number", "Calling readiness state", "Existing-number connection flow"]}
              action="Configure calling"
            />
          </div>
        </section>

        <section className="rfm-section rfm-faq-section">
          <SectionHeading
            eyebrow="Questions buyers actually ask"
            title="Understand where ReachFly fits before you create a workspace."
            text="The goal is to make the product story clear enough that a buyer can understand the use case, the workflow, and the operating model before signing up."
          />

          <div className="rfm-faq-list">
            {FAQ.map((item, index) => (
              <details key={item.question} open={index === 0}>
                <summary>
                  <span>{item.question}</span>
                  <i>+</i>
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rfm-final">
          <div className="rfm-final-grid" />
          <div>
            <span className="rfm-kicker">
              <Sparkles size={14} />
              From market to meeting
            </span>

            <h2>Your next customer is already in the market.</h2>

            <p>
              ReachFly helps you find the right businesses, understand why they may care, start the
              conversation, and keep the opportunity moving without losing the sales context in between.
            </p>

            <div className="rfm-final-actions">
              <Link className="rfm-btn primary large" to="/signup">
                Create your ReachFly workspace
                <ArrowRight size={17} />
              </Link>
              <Link className="rfm-btn ghost large" to="/login">
                Open workspace
              </Link>
            </div>

            <div className="rfm-final-path">
              {["Discover", "Context", "AI Voice", "Follow-up", "Meetings", "Pipeline"].map((item, index, arr) => (
                <span key={item}>
                  {item}
                  {index < arr.length - 1 ? <ChevronRight size={12} /> : null}
                </span>
              ))}
            </div>
          </div>
        </section>

        <footer className="rfm-footer">
          <div className="rfm-footer-brand">
            <Link className="rfm-brand" to="/">
              <span>
                <BrandLogo size={36} />
              </span>
              <div>
                <strong>ReachFly</strong>
                <small>Sales OS</small>
              </div>
            </Link>
            <p>Lead discovery, business context, AI conversations, follow-up, meetings, and pipeline operations in one connected sales workspace.</p>
          </div>

          <nav>
            <strong>Product</strong>
            <a href="#how">How it works</a>
            <a href="#voice">AI Voice</a>
            <a href="#pricing">Pricing</a>
            <Link to="/blog">Blog</Link>
          </nav>

          <nav>
            <strong>Use cases</strong>
            <Link to="/ai-lead-generation-crm">Lead generation</Link>
            <Link to="/website-audit-outreach-tool">Audit outreach</Link>
            <Link to="/auto-reach-crm">Connected follow-up</Link>
            <Link to="/local-lead-generation-tool">Local prospecting</Link>
          </nav>

          <nav>
            <strong>Company</strong>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/contact">Contact</Link>
          </nav>

          <div className="rfm-footer-trust">
            <span>
              <Shield size={13} />
              Controlled workflows
            </span>
            <span>
              <Globe2 size={13} />
              Connected sales operations
            </span>
          </div>
        </footer>
      </main>
    </>
  );
}

function SectionHeading({ eyebrow, title, text, light = false }) {
  return (
    <header className={`rfm-section-head ${light ? "light" : ""}`}>
      <span className="rfm-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </header>
  );
}

function PricingCard({ icon: Icon, title, text, points, action, featured = false }) {
  return (
    <article className={`rfm-price-card ${featured ? "featured" : ""}`}>
      {featured ? <span className="rfm-price-badge">AI Voice</span> : null}
      <header>
        <span>
          <Icon size={19} />
        </span>
        <strong>{title}</strong>
      </header>
      <p>{text}</p>
      <ul>
        {points.map((point) => (
          <li key={point}>
            <CheckCircle2 size={13} />
            {point}
          </li>
        ))}
      </ul>
      <Link className="rfm-btn primary full" to="/signup">
        {action}
        <ArrowRight size={14} />
      </Link>
    </article>
  );
}

function JourneyVisual({ step }) {
  if (step === "01") {
    return (
      <div className="rfm-journey-visual rfm-market-visual" aria-hidden="true">
        <header>
          <span>Target market</span>
          <b>Dental practices</b>
        </header>
        <div className="rfm-filter-row">
          <span>
            <MapPinned size={13} /> London
          </span>
          <span>
            <Target size={13} /> 2–20 employees
          </span>
        </div>
        <div className="rfm-lead-list">
          {["Nova Dental", "Smile Studio", "Pure Clinics"].map((lead, index) => (
            <div key={lead}>
              <i>{lead.slice(0, 1)}</i>
              <span>
                <b>{lead}</b>
                <small>{index === 0 ? "Strong fit" : index === 1 ? "Review" : "New"}</small>
              </span>
              <CheckCircle2 size={14} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === "02") {
    return (
      <div className="rfm-journey-visual rfm-context-visual" aria-hidden="true">
        <div className="rfm-score-ring">
          <b>81</b>
          <span>Opportunity</span>
        </div>
        <div>
          <span>Context signals</span>
          {["Booking friction", "Weak mobile CTA", "Slow follow-up path"].map((item, index) => (
            <p key={item}>
              <i style={{ "--signal": `${86 - index * 13}%` }} />
              {item}
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (step === "03") {
    return (
      <div className="rfm-journey-visual rfm-call-visual" aria-hidden="true">
        <header>
          <span>
            <Phone size={14} /> Calling Nova Dental
          </span>
          <em>Live</em>
        </header>
        <div className="rfm-mini-wave">
          {Array.from({ length: 30 }).map((_, index) => (
            <i key={index} style={{ "--h": `${8 + ((index * 9) % 32)}px` }} />
          ))}
        </div>
        <p>"I noticed a few opportunities in your online booking journey..."</p>
      </div>
    );
  }

  if (step === "04") {
    return (
      <div className="rfm-journey-visual rfm-outcome-visual" aria-hidden="true">
        {[
          [CheckCircle2, "Qualified", "Interest confirmed"],
          [Calendar, "Meeting", "Follow-up requested"],
          [MessageCircle, "Note", "Send audit first"],
        ].map(([Icon, title, text]) => (
          <div key={title}>
            <span>
              <Icon size={15} />
            </span>
            <p>
              <b>{title}</b>
              <small>{text}</small>
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (step === "05") {
    return (
      <div className="rfm-journey-visual rfm-email-visual" aria-hidden="true">
        <header>
          <Mail size={14} />
          <span>Follow-up draft</span>
        </header>
        <strong>Audit + next-step recap</strong>
        <p>Hi Sarah — thanks for the conversation. I pulled together the booking opportunities we discussed...</p>
        <footer>
          <span>Context attached</span>
          <button type="button">Send</button>
        </footer>
      </div>
    );
  }

  return (
    <div className="rfm-journey-visual rfm-pipeline-visual" aria-hidden="true">
      {["New", "Conversation", "Meeting"].map((stage, index) => (
        <div key={stage}>
          <span>{stage}</span>
          <article>
            <b>{index === 0 ? "Smile Studio" : index === 1 ? "Pure Clinics" : "Nova Dental"}</b>
            <small>{index === 2 ? "Tue · 10:30" : "Next action ready"}</small>
          </article>
        </div>
      ))}
    </div>
  );
}


function ReachFlyThreeScene({ progressRef, reduceMotion }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 7.2], fov: 42 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 3, 5]} intensity={8} color="#7779ff" />
      <pointLight position={[-5, -2, 2]} intensity={5} color="#9c4dff" />
      <spotLight position={[0, 6, 4]} intensity={7} angle={0.42} penumbra={0.9} color="#ffffff" />
      <SalesConstellation progressRef={progressRef} reduceMotion={reduceMotion} />
      <ThreeSparkles count={110} scale={[12, 8, 6]} size={1.7} speed={0.22} opacity={0.45} color="#a7a8ff" />
    </Canvas>
  );
}

function SalesConstellation({ progressRef, reduceMotion }) {
  const groupRef = useRef(null);
  const coreRef = useRef(null);
  const nodePositions = useMemo(
    () => [
      [-2.5, 1.55, 0.1],
      [2.65, 1.2, -0.2],
      [-2.9, -1.15, -0.4],
      [2.4, -1.55, 0.25],
      [0.1, 2.55, -0.6],
      [0.45, -2.5, -0.15],
    ],
    []
  );

  useFrame((state, delta) => {
    if (!groupRef.current || !coreRef.current) return;
    const progress = progressRef?.current || 0;
    const pointerX = state.pointer.x;
    const pointerY = state.pointer.y;
    const targetRY = progress * Math.PI * 1.35 + pointerX * 0.12;
    const targetRX = -0.18 + Math.sin(progress * Math.PI) * 0.22 + pointerY * 0.06;
    const lerp = Math.min(1, delta * 2.4);
    groupRef.current.rotation.y += (targetRY - groupRef.current.rotation.y) * lerp;
    groupRef.current.rotation.x += (targetRX - groupRef.current.rotation.x) * lerp;
    groupRef.current.position.y += ((progress - 0.5) * -0.7 - groupRef.current.position.y) * Math.min(1, delta * 1.6);
    if (!reduceMotion) {
      coreRef.current.rotation.x += delta * 0.11;
      coreRef.current.rotation.y += delta * 0.16;
    }
  });

  return (
    <group ref={groupRef} rotation={[-0.16, -0.55, 0.08]}>
      <Float speed={reduceMotion ? 0 : 1.15} rotationIntensity={reduceMotion ? 0 : 0.32} floatIntensity={reduceMotion ? 0 : 0.55}>
        <mesh ref={coreRef} scale={1.4}>
          <icosahedronGeometry args={[1.25, 2]} />
          <meshPhysicalMaterial
            color="#5558ef"
            emissive="#282aa8"
            emissiveIntensity={0.85}
            roughness={0.18}
            metalness={0.45}
            transmission={0.18}
            thickness={1.2}
            transparent
            opacity={0.78}
          />
        </mesh>
        <mesh scale={1.78} rotation={[Math.PI / 2.8, 0.2, 0.5]}>
          <torusGeometry args={[1.45, 0.012, 12, 160]} />
          <meshBasicMaterial color="#8f91ff" transparent opacity={0.52} />
        </mesh>
        <mesh scale={2.12} rotation={[0.25, Math.PI / 2.7, -0.35]}>
          <torusGeometry args={[1.45, 0.008, 10, 160]} />
          <meshBasicMaterial color="#a85cff" transparent opacity={0.34} />
        </mesh>
      </Float>

      {nodePositions.map((position, index) => (
        <group key={index} position={position}>
          <mesh>
            <sphereGeometry args={[0.09, 18, 18]} />
            <meshStandardMaterial
              color={index % 2 ? "#b16cff" : "#8c8eff"}
              emissive={index % 2 ? "#7a32ce" : "#5558ef"}
              emissiveIntensity={2.4}
              roughness={0.15}
            />
          </mesh>
          <mesh scale={2.1}>
            <sphereGeometry args={[0.09, 12, 12]} />
            <meshBasicMaterial color="#8d8fff" transparent opacity={0.12} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ProductPreview() {
  return (
    <motion.div
      className="rfm-product-preview"
      initial={{ opacity: 0, y: 24, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay: 0.12 }}
    >
      <header>
        <div>
          <i />
          <i />
          <i />
        </div>
        <small>ReachFly Sales Workspace</small>
        <Shield size={12} />
      </header>

      <div className="rfm-product-body">
        <aside>
          <span className="rfm-mini-brand">
            <BrandLogo size={23} />
          </span>

          {["Overview", "Leads", "AI Voice", "Meetings", "Inbox", "Pipeline"].map((item, index) => (
            <span key={item} className={index === 2 ? "active" : ""}>
              <i />
              {item}
            </span>
          ))}
        </aside>

        <main>
          <div className="rfm-preview-head">
            <div>
              <small>AI Voice Campaign</small>
              <strong>Dental practices · London</strong>
            </div>
            <button type="button">Launch</button>
          </div>

          <div className="rfm-preview-metrics">
            {[
              ["Ready leads", "48", Target],
              ["Queued", "9", Workflow],
              ["Live calls", "2", Phone],
              ["Meetings", "6", Calendar],
            ].map(([label, value, Icon]) => (
              <article key={label}>
                <span>
                  <Icon size={12} />
                </span>
                <strong>{value}</strong>
                <small>{label}</small>
              </article>
            ))}
          </div>

          <div className="rfm-preview-content">
            <section>
              <header>
                <span>
                  <Bot size={13} />
                </span>
                <strong>Voice Agent</strong>
                <em>Live</em>
              </header>

              <div className="rfm-call-wave">
                {Array.from({ length: 24 }).map((_, index) => (
                  <i key={index} style={{ "--wave-height": `${9 + ((index * 7) % 23)}px` }} />
                ))}
              </div>

              <p>Calling qualified leads and writing outcomes back to the same workspace.</p>
            </section>

            <section>
              <header>
                <span>
                  <Brain size={13} />
                </span>
                <strong>Lead context</strong>
              </header>
              <div className="rfm-context-score">
                <b>81</b>
                <span>Opportunity score</span>
              </div>
            </section>

            <div className="rfm-preview-table">
              {[
                ["Nova Dental", "Meeting booked", "Won"],
                ["Smile Studio", "Callback", "Live"],
                ["Pure Clinics", "Email follow-up", "Next"],
              ].map(([lead, outcome, status]) => (
                <div key={lead}>
                  <span>{lead}</span>
                  <small>{outcome}</small>
                  <em>{status}</em>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </motion.div>
  );
}

function VoicePreview() {
  return (
    <div className="rfm-voice-preview">
      <header>
        <span>
          <Phone size={15} />
        </span>
        <div>
          <small>Active AI Voice conversation</small>
          <strong>Nova Dental</strong>
        </div>
        <em>02:14</em>
      </header>

      <div className="rfm-voice-wave">
        {Array.from({ length: 44 }).map((_, index) => (
          <i key={index} style={{ "--voice-height": `${8 + ((index * 13) % 34)}px` }} />
        ))}
      </div>

      <div className="rfm-transcript">
        <article>
          <span>AI</span>
          <p>
            I noticed your booking journey could make it easier for new patients to choose a time.
            Is improving online conversion a priority this quarter?
          </p>
        </article>

        <article className="contact">
          <span>ND</span>
          <p>
            Yes, we'd like more bookings from the website. Send me the audit and let's schedule a follow-up.
          </p>
        </article>
      </div>

      <footer>
        <span>
          <CheckCircle2 size={13} />
          Qualified
        </span>
        <span>
          <Calendar size={13} />
          Meeting suggested
        </span>
      </footer>
    </div>
  );
}

function MarketingStyles() {
  return (
    <style>{`
      .rf-marketing-v8{
        --rfm-bg:#f8f9fb;
        --rfm-card:#ffffff;
        --rfm-text:#15171a;
        --rfm-text-2:#474b54;
        --rfm-muted:#747985;
        --rfm-line:#e3e6eb;
        --rfm-line-strong:#d4d8e0;
        --rfm-primary:#5759df;
        --rfm-primary-dark:#4547ca;
        --rfm-primary-soft:#ececff;
        --rfm-violet:#7a47dd;
        --rfm-violet-soft:#f3edff;
        --rfm-dark:#24272b;
        --rfm-dark-2:#191b1f;
        --rfm-green:#0b8358;
        --rfm-green-soft:#e8f8f0;
        --rfm-shadow:0 24px 70px rgba(28,31,38,.11);
        --rfm-shadow-soft:0 10px 30px rgba(28,31,38,.07);
        --rfm-ease:cubic-bezier(.2,.8,.2,1);
        min-height:100vh;
        overflow:hidden;
        color:var(--rfm-text);
        background:var(--rfm-bg);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .rf-marketing-v8 *,
      .rf-marketing-v8 *::before,
      .rf-marketing-v8 *::after{box-sizing:border-box}

      .rf-marketing-v8 a{color:inherit}
      .rf-marketing-v8 button,.rf-marketing-v8 input{font:inherit}

      .rfm-nav{
        position:sticky;
        z-index:120;
        top:0;
        min-height:72px;
        display:grid;
        grid-template-columns:auto 1fr auto;
        align-items:center;
        gap:28px;
        padding:0 max(24px,calc((100vw - 1440px)/2));
        background:rgba(248,249,251,.88);
        border-bottom:1px solid rgba(227,230,235,.82);
        backdrop-filter:blur(18px);
      }

      .rfm-brand{display:flex;align-items:center;gap:9px;width:max-content;text-decoration:none}
      .rfm-brand>span{width:39px;height:39px;display:grid;place-items:center}
      .rfm-brand>div{display:grid;gap:0}
      .rfm-brand strong{font:650 16px/19px Geist,Inter,sans-serif;letter-spacing:-.025em}
      .rfm-brand small{color:var(--rfm-primary);font-size:7px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}

      .rfm-desktop-nav{justify-self:center;display:flex;align-items:center;gap:26px}
      .rfm-desktop-nav a{color:var(--rfm-text-2);text-decoration:none;font-size:11px;font-weight:650;transition:color .15s var(--rfm-ease)}
      .rfm-desktop-nav a:hover{color:var(--rfm-primary)}

      .rfm-nav-actions{display:flex;align-items:center;gap:8px}
      .rfm-btn{min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:8px 13px;border:1px solid transparent;border-radius:10px;text-decoration:none;white-space:nowrap;font-size:11px;font-weight:750;transition:transform .15s var(--rfm-ease),background .15s var(--rfm-ease),border-color .15s var(--rfm-ease),box-shadow .15s var(--rfm-ease)}
      .rfm-btn:hover{transform:translateY(-1px)}
      .rfm-btn.primary{color:#fff;background:linear-gradient(135deg,var(--rfm-primary),#6c52dc);border-color:rgba(80,82,203,.55);box-shadow:0 9px 24px rgba(87,89,223,.2)}
      .rfm-btn.primary:hover{background:linear-gradient(135deg,var(--rfm-primary-dark),#5d44c8)}
      .rfm-btn.secondary{background:#fff;border-color:var(--rfm-line)}
      .rfm-btn.ghost{color:inherit;background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18)}
      .rfm-btn.large{min-height:51px;padding:11px 17px;border-radius:12px;font-size:12px}
      .rfm-btn.full{width:100%;margin-top:auto}

      .rfm-menu-btn{display:none;width:40px;height:40px;place-items:center;padding:0;color:var(--rfm-text);background:#fff;border:1px solid var(--rfm-line);border-radius:10px}

      .rfm-mobile-backdrop{position:fixed;z-index:220;inset:0;display:grid;justify-items:end;background:rgba(18,20,24,.46);backdrop-filter:blur(6px)}
      .rfm-mobile-menu{width:min(390px,92vw);height:100%;display:flex;flex-direction:column;padding:20px;background:#fff;box-shadow:-20px 0 70px rgba(0,0,0,.16)}
      .rfm-mobile-menu>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:18px;border-bottom:1px solid var(--rfm-line)}
      .rfm-mobile-menu>header>button{width:38px;height:38px;display:grid;place-items:center;background:#f7f8fa;border:1px solid var(--rfm-line);border-radius:10px}
      .rfm-mobile-menu>nav{display:grid;gap:4px;padding:20px 0}
      .rfm-mobile-menu>nav a{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 10px;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700}
      .rfm-mobile-menu>nav a:hover{color:var(--rfm-primary);background:var(--rfm-primary-soft)}
      .rfm-mobile-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:auto}

      .rfm-hero{position:relative;min-height:760px;display:grid;grid-template-columns:minmax(0,.88fr) minmax(560px,1.12fr);align-items:center;gap:54px;overflow:hidden;padding:92px max(32px,calc((100vw - 1380px)/2)) 82px;color:#fff;background:linear-gradient(145deg,#24272b,#292c31 52%,#202327)}
      .rfm-hero-grid{position:absolute;inset:0;opacity:.32;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:34px 34px;mask-image:linear-gradient(#000,transparent 94%)}
      .rfm-hero-glow{position:absolute;width:520px;height:520px;border-radius:50%;filter:blur(10px);pointer-events:none}
      .rfm-hero-glow-one{left:-220px;top:-180px;background:radial-gradient(circle,rgba(87,89,223,.28),transparent 65%)}
      .rfm-hero-glow-two{right:-100px;bottom:-220px;background:radial-gradient(circle,rgba(122,71,221,.25),transparent 65%)}
      .rfm-hero-copy,.rfm-hero-preview-wrap{position:relative;z-index:2}
      .rfm-kicker{width:max-content;max-width:100%;min-height:31px;display:inline-flex;align-items:center;gap:7px;padding:6px 10px;color:#dfe0ff;background:rgba(87,89,223,.15);border:1px solid rgba(167,169,255,.15);border-radius:999px;font-size:9px;font-weight:800;letter-spacing:.075em;text-transform:uppercase}
      .rfm-hero-copy h1{max-width:700px;margin:20px 0 0;color:#fff;font:630 clamp(48px,5.2vw,76px)/.98 Geist,Inter,sans-serif;letter-spacing:-.057em}
      .rfm-hero-copy h1 em{color:#b8b9ff;font-style:normal}
      .rfm-hero-copy>p{max-width:650px;margin:22px 0 0;color:rgba(241,243,245,.72);font-size:15px;line-height:25px}
      .rfm-hero-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:29px}
      .rfm-proof{display:flex;flex-wrap:wrap;gap:14px;margin-top:22px;color:rgba(239,241,244,.63)}
      .rfm-proof span{display:flex;align-items:center;gap:6px;font-size:9px;font-weight:650}
      .rfm-proof svg{color:#bfc1ff}
      .rfm-hero-preview-wrap{display:grid;gap:11px}
      .rfm-preview-caption{justify-self:end;color:rgba(255,255,255,.46);font-size:8px;letter-spacing:.04em;text-transform:uppercase}

      .rfm-product-preview{overflow:hidden;background:#fbfbfc;border:1px solid rgba(255,255,255,.7);border-radius:17px;box-shadow:0 42px 95px rgba(0,0,0,.31),0 8px 20px rgba(0,0,0,.13);transform:perspective(1300px) rotateY(-2deg) rotateX(.7deg)}
      .rfm-product-preview>header{height:40px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 13px;color:#7c7d85;background:#f1f2f4;border-bottom:1px solid #e2e4e6}
      .rfm-product-preview>header>div{display:flex;gap:5px}.rfm-product-preview>header i{width:7px;height:7px;background:#c6c8cc;border-radius:50%}.rfm-product-preview>header small{font-size:7px;font-weight:750;text-transform:uppercase;letter-spacing:.04em}.rfm-product-preview>header svg{justify-self:end}
      .rfm-product-body{min-height:485px;display:grid;grid-template-columns:118px minmax(0,1fr)}
      .rfm-product-body>aside{display:grid;align-content:start;gap:5px;padding:16px 9px;background:#2f3236}.rfm-mini-brand{width:36px;height:36px;display:grid;place-items:center;margin:0 0 13px 5px}.rfm-product-body>aside>span:not(.rfm-mini-brand){min-height:34px;display:flex;align-items:center;gap:7px;padding:6px 8px;color:#a4a8ae;border-radius:7px;font-size:7px}.rfm-product-body>aside>span.active{color:#fff;background:#5759df}.rfm-product-body>aside>span i{width:12px;height:4px;background:currentColor;border-radius:999px;opacity:.75}
      .rfm-product-body>main{min-width:0;padding:18px;color:var(--rfm-text);background:#f8f9fa}.rfm-preview-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.rfm-preview-head>div{display:grid}.rfm-preview-head small{color:var(--rfm-primary);font-size:6px;font-weight:800;text-transform:uppercase}.rfm-preview-head strong{font:650 13px/18px Geist,Inter,sans-serif}.rfm-preview-head button{min-height:31px;padding:5px 10px;color:#fff;background:var(--rfm-primary);border:0;border-radius:7px;font-size:6px;font-weight:750}
      .rfm-preview-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}.rfm-preview-metrics article{min-height:80px;display:grid;align-content:space-between;padding:9px;background:#fff;border:1px solid #e4e6e8;border-radius:9px}.rfm-preview-metrics article>span{width:27px;height:27px;display:grid;place-items:center;color:var(--rfm-primary);background:var(--rfm-primary-soft);border-radius:7px}.rfm-preview-metrics article strong{margin-top:6px;font-size:14px}.rfm-preview-metrics article small{color:#83848b;font-size:6px}
      .rfm-preview-content{display:grid;grid-template-columns:1.2fr .8fr;gap:8px;margin-top:9px}.rfm-preview-content>section{min-height:145px;padding:11px;background:#fff;border:1px solid #e4e6e8;border-radius:9px}.rfm-preview-content>section>header{display:flex;align-items:center;gap:6px}.rfm-preview-content>section header>span{width:26px;height:26px;display:grid;place-items:center;color:var(--rfm-primary);background:var(--rfm-primary-soft);border-radius:7px}.rfm-preview-content>section header strong{flex:1;font-size:7px}.rfm-preview-content>section header em{padding:3px 5px;color:#087a51;background:#dff8eb;border-radius:999px;font-size:5px;font-style:normal}.rfm-call-wave{height:46px;display:flex;align-items:center;justify-content:center;gap:3px;margin:8px 0}.rfm-call-wave i{width:3px;height:var(--wave-height);background:#6d6fe1;border-radius:999px}.rfm-preview-content section>p{margin:0;color:#7b7d84;font-size:6px;line-height:10px}.rfm-context-score{min-height:91px;display:grid;place-content:center;justify-items:center}.rfm-context-score b{font-size:28px;line-height:31px}.rfm-context-score span{color:#81838a;font-size:6px}.rfm-preview-table{grid-column:1/-1;display:grid;overflow:hidden;background:#fff;border:1px solid #e4e6e8;border-radius:9px}.rfm-preview-table>div{min-height:38px;display:grid;grid-template-columns:1.2fr 1fr auto;align-items:center;gap:8px;padding:0 10px;border-bottom:1px solid #eef0f2}.rfm-preview-table>div:last-child{border-bottom:0}.rfm-preview-table span{font-size:6.5px;font-weight:750}.rfm-preview-table small{color:#777a81;font-size:5.5px}.rfm-preview-table em{padding:3px 5px;color:var(--rfm-primary);background:var(--rfm-primary-soft);border-radius:999px;font-size:5px;font-style:normal}

      .rfm-trusted-section{width:min(1320px,calc(100% - 48px));display:grid;grid-template-columns:minmax(260px,.75fr) 1.25fr;align-items:center;gap:34px;margin:0 auto;padding:30px 0;border-bottom:1px solid var(--rfm-line)}
      .rfm-trusted-copy{display:grid;gap:5px}.rfm-trusted-copy>span{color:var(--rfm-primary);font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.rfm-trusted-copy>strong{max-width:470px;font:620 15px/22px Geist,Inter,sans-serif;color:var(--rfm-text-2)}
      .rfm-audience-pills,.rfm-customer-logos{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.rfm-audience-pills span,.rfm-customer-logo{min-height:42px;display:inline-flex;align-items:center;justify-content:center;padding:9px 15px;color:#666b76;background:#fff;border:1px solid var(--rfm-line);border-radius:11px;font-size:10px;font-weight:750;box-shadow:0 4px 14px rgba(25,28,34,.03)}.rfm-customer-logo img{max-width:110px;max-height:28px;object-fit:contain}

      .rfm-section{width:min(1240px,calc(100% - 48px));margin:0 auto;padding:96px 0}.rfm-section-head{max-width:820px;display:grid;gap:11px;margin-bottom:42px}.rfm-eyebrow{color:var(--rfm-primary);font-size:9px;font-weight:850;letter-spacing:.11em;text-transform:uppercase}.rfm-section-head h2,.rfm-trust-head h2{margin:0;font:630 clamp(34px,4vw,52px)/1.03 Geist,Inter,sans-serif;letter-spacing:-.045em}.rfm-section-head p,.rfm-trust-head p{max-width:780px;margin:0;color:var(--rfm-text-2);font-size:14px;line-height:24px}.rfm-section-head.light h2{color:#fff}.rfm-section-head.light p{color:rgba(244,246,248,.64)}.rfm-section-head.light .rfm-eyebrow{color:#c3c4ff}

      .rfm-problem-section{padding-bottom:84px}.rfm-problem-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.rfm-problem-grid article{min-height:260px;display:flex;flex-direction:column;padding:24px;background:#fff;border:1px solid var(--rfm-line);border-radius:16px;box-shadow:0 7px 24px rgba(24,27,33,.035)}.rfm-problem-grid article>span{width:44px;height:44px;display:grid;place-items:center;color:var(--rfm-primary);background:var(--rfm-primary-soft);border-radius:12px}.rfm-problem-grid article strong{margin-top:40px;font:630 18px/24px Geist,Inter,sans-serif}.rfm-problem-grid article p{margin:9px 0 0;color:var(--rfm-muted);font-size:11px;line-height:19px}.rfm-bridge-callout{display:grid;grid-template-columns:.8fr 1.2fr;align-items:center;gap:30px;margin-top:18px;padding:24px 26px;background:linear-gradient(135deg,#fff,#f3f3ff);border:1px solid #dedfff;border-radius:17px}.rfm-bridge-callout h3{max-width:520px;margin:7px 0 0;font:620 22px/28px Geist,Inter,sans-serif;letter-spacing:-.03em}.rfm-bridge-flow{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:7px}.rfm-bridge-flow>span{display:flex;align-items:center;gap:7px;color:var(--rfm-muted);font-size:8px}.rfm-bridge-flow b{min-height:34px;display:inline-flex;align-items:center;padding:7px 10px;color:var(--rfm-primary);background:#fff;border:1px solid #dbdcf8;border-radius:9px;font-size:8px}

      .rfm-stack-section{background:linear-gradient(145deg,#22252a,#2a2d32);border-block:1px solid rgba(255,255,255,.04)}.rfm-stack-inner{padding-block:92px}.rfm-stack-compare{display:grid;grid-template-columns:1fr 1fr;gap:16px}.rfm-stack-compare>article{min-height:420px;padding:25px;border-radius:18px}.rfm-stack-fragmented{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08)}.rfm-stack-fragmented header,.rfm-stack-reachfly header{display:grid;gap:6px}.rfm-stack-fragmented header span{color:#b4b7c0;font-size:8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.rfm-stack-fragmented header strong{color:#fff;font:620 22px/28px Geist,Inter,sans-serif}.rfm-stack-fragmented>div{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:34px}.rfm-stack-fragmented>div span{min-height:48px;display:flex;align-items:center;gap:9px;padding:10px 12px;color:#d0d3d8;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.065);border-radius:10px;font-size:9px}.rfm-stack-fragmented p{margin:28px 0 0;color:#8e939b;font-size:10px;line-height:17px}.rfm-stack-reachfly{display:flex;flex-direction:column;background:linear-gradient(145deg,#fbfbff,#eeefff);border:1px solid rgba(184,186,255,.5);box-shadow:0 24px 60px rgba(0,0,0,.13)}.rfm-stack-reachfly>header{display:flex;align-items:center;gap:12px}.rfm-mini-logo{width:46px;height:46px;display:grid;place-items:center;background:#fff;border:1px solid #dfe0f2;border-radius:12px}.rfm-stack-reachfly>header div{display:grid;gap:2px}.rfm-stack-reachfly>header small{color:var(--rfm-primary);font-size:8px;font-weight:850;text-transform:uppercase}.rfm-stack-reachfly>header strong{font:620 21px/27px Geist,Inter,sans-serif}.rfm-stack-path{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:38px}.rfm-stack-path>span{position:relative;display:grid;justify-items:center;gap:7px;text-align:center}.rfm-stack-path>span>i{width:44px;height:44px;display:grid;place-items:center;color:var(--rfm-primary);background:#fff;border:1px solid #dadcf2;border-radius:12px}.rfm-stack-path>span>b{font-size:7px}.rfm-stack-path>span>svg{position:absolute;top:16px;right:-6px;color:#a4a6bd}.rfm-stack-result{display:flex;align-items:center;gap:11px;margin-top:auto;padding:16px;color:var(--rfm-green);background:#fff;border:1px solid #dfe4e5;border-radius:13px}.rfm-stack-result>div{display:grid;gap:3px}.rfm-stack-result strong{color:var(--rfm-text);font-size:10px}.rfm-stack-result span{color:var(--rfm-muted);font-size:8px}

      .rfm-journey-section{padding-bottom:108px}.rfm-journey{display:grid;gap:14px}.rfm-journey>article{display:grid;grid-template-columns:90px minmax(0,.95fr) minmax(440px,1.05fr);align-items:center;gap:28px;padding:28px;background:#fff;border:1px solid var(--rfm-line);border-radius:18px;box-shadow:0 10px 32px rgba(24,27,33,.04)}.rfm-journey>article.reverse .rfm-journey-visual{order:-1}.rfm-journey>article.reverse{grid-template-columns:minmax(440px,1.05fr) 90px minmax(0,.95fr)}.rfm-journey>article.reverse .rfm-journey-index{grid-column:2}.rfm-journey>article.reverse .rfm-journey-copy{grid-column:3}.rfm-journey-index{display:grid;justify-items:center;gap:13px}.rfm-journey-index>span{color:#c2c5cd;font:650 22px/1 Geist,Inter,sans-serif}.rfm-journey-index>i{width:52px;height:52px;display:grid;place-items:center;color:var(--rfm-primary);background:var(--rfm-primary-soft);border-radius:14px}.rfm-journey-copy small{color:var(--rfm-primary);font-size:8px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.rfm-journey-copy h3{margin:8px 0 0;font:620 24px/30px Geist,Inter,sans-serif;letter-spacing:-.035em}.rfm-journey-copy p{margin:10px 0 0;color:var(--rfm-muted);font-size:11px;line-height:19px}.rfm-journey-copy em{display:block;margin-top:15px;color:#888d97;font-size:7px;font-style:normal;font-weight:750;letter-spacing:.04em;text-transform:uppercase}.rfm-journey-visual{min-height:250px;padding:19px;background:linear-gradient(145deg,#f7f8fa,#f0f1f5);border:1px solid #e4e7ec;border-radius:15px}
      .rfm-market-visual>header{display:grid;gap:3px}.rfm-market-visual>header span,.rfm-context-visual>div>span{color:var(--rfm-primary);font-size:7px;font-weight:800;text-transform:uppercase}.rfm-market-visual>header b{font:620 16px/21px Geist,Inter,sans-serif}.rfm-filter-row{display:flex;gap:7px;margin-top:12px}.rfm-filter-row span{display:flex;align-items:center;gap:5px;padding:6px 8px;background:#fff;border:1px solid #dee1e6;border-radius:8px;color:#696e79;font-size:7px}.rfm-lead-list{display:grid;gap:6px;margin-top:13px}.rfm-lead-list>div{min-height:46px;display:flex;align-items:center;gap:9px;padding:8px 9px;background:#fff;border:1px solid #e1e4e8;border-radius:9px}.rfm-lead-list>div>i{width:28px;height:28px;display:grid;place-items:center;color:#fff;background:linear-gradient(145deg,var(--rfm-primary),var(--rfm-violet));border-radius:8px;font-size:8px;font-style:normal;font-weight:800}.rfm-lead-list>div>span{flex:1;display:grid}.rfm-lead-list b{font-size:8px}.rfm-lead-list small{color:#969aa3;font-size:6px}.rfm-lead-list svg{color:var(--rfm-green)}
      .rfm-context-visual{display:grid;grid-template-columns:.75fr 1.25fr;align-items:center;gap:20px}.rfm-score-ring{width:125px;height:125px;display:grid;place-content:center;justify-items:center;margin:auto;background:radial-gradient(circle at center,#fff 56%,transparent 57%),conic-gradient(var(--rfm-primary) 0 81%,#dfe1e7 81% 100%);border-radius:50%}.rfm-score-ring b{font:650 30px/1 Geist,Inter,sans-serif}.rfm-score-ring span{margin-top:4px;color:#9498a2;font-size:6px}.rfm-context-visual>div:last-child{display:grid;gap:12px}.rfm-context-visual p{margin:0;color:#616671;font-size:7px}.rfm-context-visual p i{display:block;width:var(--signal);height:6px;margin-bottom:4px;background:linear-gradient(90deg,var(--rfm-primary),#9b76e7);border-radius:999px}
      .rfm-call-visual>header{display:flex;align-items:center;justify-content:space-between;gap:8px}.rfm-call-visual>header span{display:flex;align-items:center;gap:7px;font-size:8px;font-weight:800}.rfm-call-visual>header em{padding:4px 7px;color:var(--rfm-green);background:var(--rfm-green-soft);border-radius:999px;font-size:6px;font-style:normal}.rfm-mini-wave{height:95px;display:flex;align-items:center;justify-content:center;gap:3px;margin-top:14px}.rfm-mini-wave i{width:4px;height:var(--h);background:linear-gradient(#7779e8,#a078e2);border-radius:99px}.rfm-call-visual>p{margin:9px 0 0;padding:10px;color:#5c616b;background:#fff;border:1px solid #e1e4e8;border-radius:9px;font-size:7px;line-height:12px}
      .rfm-outcome-visual{display:grid;align-content:center;gap:8px}.rfm-outcome-visual>div{display:flex;align-items:center;gap:10px;padding:11px;background:#fff;border:1px solid #e1e4e8;border-radius:10px}.rfm-outcome-visual>div>span{width:34px;height:34px;display:grid;place-items:center;color:var(--rfm-primary);background:var(--rfm-primary-soft);border-radius:9px}.rfm-outcome-visual p{display:grid;gap:2px;margin:0}.rfm-outcome-visual b{font-size:8px}.rfm-outcome-visual small{color:#8c919a;font-size:6px}
      .rfm-email-visual{display:grid;align-content:start}.rfm-email-visual>header{display:flex;align-items:center;gap:7px;color:var(--rfm-primary);font-size:7px;font-weight:800;text-transform:uppercase}.rfm-email-visual>strong{margin-top:18px;font:620 15px/20px Geist,Inter,sans-serif}.rfm-email-visual>p{margin:10px 0 0;padding:12px;color:#696e77;background:#fff;border:1px solid #e1e4e8;border-radius:10px;font-size:7px;line-height:13px}.rfm-email-visual>footer{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px}.rfm-email-visual>footer span{color:#8b9099;font-size:6px}.rfm-email-visual>footer button{padding:6px 10px;color:#fff;background:var(--rfm-primary);border:0;border-radius:7px;font-size:6px;font-weight:750}
      .rfm-pipeline-visual{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.rfm-pipeline-visual>div{padding:8px;background:rgba(255,255,255,.55);border:1px solid #e1e4e8;border-radius:10px}.rfm-pipeline-visual>div>span{color:#8e939b;font-size:6px;font-weight:800;text-transform:uppercase}.rfm-pipeline-visual article{min-height:80px;display:grid;align-content:start;gap:5px;margin-top:9px;padding:9px;background:#fff;border:1px solid #dfe2e7;border-radius:8px;box-shadow:0 5px 14px rgba(28,31,38,.05)}.rfm-pipeline-visual b{font-size:7px}.rfm-pipeline-visual small{color:#92969f;font-size:5.5px}

      .rfm-usecase-section{background:#f1f2f6;border-block:1px solid #e2e5ea}.rfm-usecase-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}.rfm-usecase-grid article{grid-column:span 2;min-height:350px;display:flex;flex-direction:column;padding:24px;background:#fff;border:1px solid var(--rfm-line);border-radius:16px;box-shadow:0 7px 22px rgba(24,27,33,.035)}.rfm-usecase-grid article.featured{grid-column:span 3;color:#fff;background:linear-gradient(145deg,#292c31,#333743);border-color:rgba(255,255,255,.05)}.rfm-usecase-grid article:nth-child(2){grid-column:span 3}.rfm-usecase-grid header{display:flex;align-items:center;gap:9px}.rfm-usecase-grid header>span{width:42px;height:42px;display:grid;place-items:center;color:var(--rfm-primary);background:var(--rfm-primary-soft);border-radius:11px}.rfm-usecase-grid article.featured header>span{color:#d4d5ff;background:rgba(87,89,223,.18)}.rfm-usecase-grid header small{color:var(--rfm-primary);font-size:8px;font-weight:850;text-transform:uppercase}.rfm-usecase-grid article.featured header small{color:#c5c6ff}.rfm-usecase-grid h3{margin:28px 0 0;font:620 22px/28px Geist,Inter,sans-serif;letter-spacing:-.03em}.rfm-usecase-grid p{margin:10px 0 0;color:var(--rfm-muted);font-size:10px;line-height:18px}.rfm-usecase-grid article.featured p{color:rgba(242,244,247,.62)}.rfm-usecase-grid ul{display:grid;gap:7px;margin:20px 0 0;padding:0;list-style:none}.rfm-usecase-grid li{display:flex;align-items:center;gap:7px;color:#636873;font-size:8px}.rfm-usecase-grid article.featured li{color:#c6c9cf}.rfm-usecase-grid li svg{color:var(--rfm-primary)}.rfm-usecase-grid article>a{display:inline-flex;align-items:center;gap:6px;width:max-content;margin-top:auto;padding-top:24px;color:var(--rfm-primary);text-decoration:none;font-size:9px;font-weight:800}.rfm-usecase-grid article.featured>a{color:#c7c8ff}

      .rfm-voice-chapter{color:#fff;background:linear-gradient(145deg,#202327,#292c31 55%,#22242a)}.rfm-voice-section{display:grid;grid-template-columns:.9fr 1.1fr;align-items:center;gap:70px;padding-block:104px}.rfm-voice-copy h2{margin:18px 0 0;color:#fff;font:630 clamp(38px,4.2vw,58px)/1.02 Geist,Inter,sans-serif;letter-spacing:-.048em}.rfm-voice-copy>p{max-width:600px;margin:20px 0 0;color:rgba(239,241,244,.67);font-size:13px;line-height:23px}.rfm-voice-points{display:grid;gap:10px;margin-top:24px}.rfm-voice-points span{display:flex;align-items:center;gap:9px;color:#d7dade;font-size:9px}.rfm-voice-points svg{color:#9fa1ff}.rfm-inline-cta{display:inline-flex;align-items:center;gap:7px;margin-top:27px;color:#c3c4ff;text-decoration:none;font-size:10px;font-weight:800}.rfm-voice-demo-wrap{position:relative;padding-bottom:80px}.rfm-voice-preview{overflow:hidden;background:#fff;border:1px solid rgba(255,255,255,.14);border-radius:17px;box-shadow:0 32px 76px rgba(0,0,0,.28)}.rfm-voice-preview>header{display:flex;align-items:center;gap:10px;padding:16px;color:var(--rfm-text);background:#f8f9fa;border-bottom:1px solid #e5e7eb}.rfm-voice-preview>header>span{width:36px;height:36px;display:grid;place-items:center;color:var(--rfm-primary);background:var(--rfm-primary-soft);border-radius:10px}.rfm-voice-preview>header>div{flex:1;display:grid}.rfm-voice-preview>header small{color:#8a8e97;font-size:7px}.rfm-voice-preview>header strong{font-size:11px}.rfm-voice-preview>header em{color:var(--rfm-green);font-size:8px;font-style:normal;font-weight:800}.rfm-voice-wave{height:105px;display:flex;align-items:center;justify-content:center;gap:4px;padding:0 20px;background:#fafbfc}.rfm-voice-wave i{width:4px;height:var(--voice-height);background:linear-gradient(#686be2,#976de2);border-radius:999px}.rfm-transcript{display:grid;gap:9px;padding:16px;background:#f5f6f8}.rfm-transcript article{display:flex;gap:9px}.rfm-transcript article>span{width:30px;height:30px;display:grid;place-items:center;flex:0 0 30px;color:#fff;background:var(--rfm-primary);border-radius:8px;font-size:7px;font-weight:800}.rfm-transcript article.contact>span{color:var(--rfm-primary);background:var(--rfm-primary-soft)}.rfm-transcript p{margin:0;padding:10px 11px;color:#686d76;background:#fff;border:1px solid #e4e6ea;border-radius:10px;font-size:7px;line-height:13px}.rfm-voice-preview>footer{display:flex;gap:8px;padding:13px 16px;background:#fff}.rfm-voice-preview>footer span{display:flex;align-items:center;gap:5px;padding:6px 8px;color:var(--rfm-green);background:var(--rfm-green-soft);border-radius:8px;font-size:7px;font-weight:750}.rfm-voice-context-card{position:absolute;right:-20px;bottom:0;width:260px;padding:15px;color:var(--rfm-text);background:rgba(255,255,255,.98);border:1px solid #e0e3e8;border-radius:14px;box-shadow:var(--rfm-shadow)}.rfm-voice-context-card>span{display:flex;align-items:center;gap:7px;color:var(--rfm-primary);font-size:7px;font-weight:850;text-transform:uppercase}.rfm-voice-context-card>div{display:grid;gap:2px;padding:10px 0;border-bottom:1px solid #eef0f3}.rfm-voice-context-card>div:last-child{border-bottom:0}.rfm-voice-context-card b{font-size:7px}.rfm-voice-context-card p{margin:0;color:#858a94;font-size:6px;line-height:10px}

      .rfm-agent-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.rfm-agent-grid article{min-height:260px;padding:20px;background:#fff;border:1px solid var(--rfm-line);border-radius:15px}.rfm-agent-grid article>header{display:flex;align-items:center;justify-content:space-between}.rfm-agent-grid article>header span{width:42px;height:42px;display:grid;place-items:center;color:var(--rfm-primary);background:var(--rfm-primary-soft);border-radius:11px}.rfm-agent-grid article>header em{color:#c7c9d0;font-size:12px;font-style:normal;font-weight:700}.rfm-agent-grid article>small{display:block;margin-top:33px;color:var(--rfm-primary);font-size:7px;font-weight:850;text-transform:uppercase}.rfm-agent-grid article>strong{display:block;margin-top:6px;font:620 17px/22px Geist,Inter,sans-serif}.rfm-agent-grid article>p{margin:8px 0 0;color:var(--rfm-muted);font-size:9px;line-height:16px}.rfm-agent-linkage{display:flex;align-items:center;gap:13px;margin-top:12px;padding:18px 20px;background:linear-gradient(135deg,#fff,#f3f3ff);border:1px solid #dfe0fa;border-radius:14px}.rfm-agent-linkage>span{width:42px;height:42px;display:grid;place-items:center;color:var(--rfm-primary);background:#fff;border:1px solid #dddef1;border-radius:11px}.rfm-agent-linkage>div{display:grid;gap:3px}.rfm-agent-linkage strong{font-size:10px}.rfm-agent-linkage p{margin:0;color:#7e838d;font-size:8px;line-height:14px}

      .rfm-trust-chapter{background:#eef0f5;border-block:1px solid #e1e4e9}.rfm-trust-head{display:grid;grid-template-columns:1fr 340px;align-items:end;gap:55px}.rfm-trust-head>div:first-child{display:grid;gap:11px}.rfm-trust-seal{display:grid;justify-items:start;gap:8px;padding:22px;background:#fff;border:1px solid var(--rfm-line);border-radius:15px;box-shadow:var(--rfm-shadow-soft)}.rfm-trust-seal>svg{color:var(--rfm-primary)}.rfm-trust-seal strong{font:620 15px/20px Geist,Inter,sans-serif}.rfm-trust-seal span{color:#888d96;font-size:7px}.rfm-trust-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:40px}.rfm-trust-grid article{display:flex;gap:12px;min-height:135px;padding:18px;background:#fff;border:1px solid var(--rfm-line);border-radius:14px}.rfm-trust-grid article>span{width:38px;height:38px;display:grid;place-items:center;flex:0 0 38px;color:var(--rfm-primary);background:var(--rfm-primary-soft);border-radius:10px}.rfm-trust-grid article>div{display:grid;align-content:start;gap:6px}.rfm-trust-grid strong{font-size:10px}.rfm-trust-grid p{margin:0;color:var(--rfm-muted);font-size:8px;line-height:14px}.rfm-trust-note{display:flex;align-items:flex-start;gap:9px;margin-top:12px;padding:14px 16px;color:#5f6470;background:#fff;border:1px dashed #cfd3dc;border-radius:12px}.rfm-trust-note svg{flex:0 0 auto;color:var(--rfm-green)}.rfm-trust-note p{margin:0;font-size:8px;line-height:14px}

      .rfm-pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.rfm-price-card{position:relative;min-height:390px;display:flex;flex-direction:column;padding:24px;background:#fff;border:1px solid var(--rfm-line);border-radius:16px;box-shadow:0 8px 26px rgba(24,27,33,.035)}.rfm-price-card.featured{border-color:#bfc0ff;box-shadow:0 14px 36px rgba(87,89,223,.11)}.rfm-price-badge{position:absolute;top:16px;right:16px;padding:5px 8px;color:var(--rfm-primary);background:var(--rfm-primary-soft);border-radius:999px;font-size:7px;font-weight:850;text-transform:uppercase}.rfm-price-card>header{display:flex;align-items:center;gap:10px}.rfm-price-card>header span{width:43px;height:43px;display:grid;place-items:center;color:var(--rfm-primary);background:var(--rfm-primary-soft);border-radius:11px}.rfm-price-card>header strong{font:620 17px/22px Geist,Inter,sans-serif}.rfm-price-card>p{margin:24px 0 0;color:var(--rfm-muted);font-size:10px;line-height:18px}.rfm-price-card>ul{display:grid;gap:9px;margin:24px 0 30px;padding:0;list-style:none}.rfm-price-card li{display:flex;align-items:center;gap:8px;color:#666b75;font-size:8px}.rfm-price-card li svg{color:var(--rfm-green)}

      .rfm-faq-section{padding-top:70px}.rfm-faq-list{display:grid;grid-template-columns:1fr 1fr;gap:9px}.rfm-faq-list details{background:#fff;border:1px solid var(--rfm-line);border-radius:13px}.rfm-faq-list summary{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;cursor:pointer;list-style:none;font:620 12px/18px Geist,Inter,sans-serif}.rfm-faq-list summary::-webkit-details-marker{display:none}.rfm-faq-list summary i{width:28px;height:28px;display:grid;place-items:center;color:var(--rfm-primary);background:var(--rfm-primary-soft);border-radius:8px;font-size:18px;font-style:normal;font-weight:400;transition:transform .15s var(--rfm-ease)}.rfm-faq-list details[open] summary i{transform:rotate(45deg)}.rfm-faq-list details p{margin:0;padding:0 18px 18px;color:var(--rfm-muted);font-size:9px;line-height:16px}

      .rfm-final{position:relative;width:min(1260px,calc(100% - 48px));overflow:hidden;margin:20px auto 50px;padding:72px 64px;color:#fff;background:linear-gradient(145deg,#26292e,#30333a 55%,#24272c);border:1px solid rgba(255,255,255,.06);border-radius:22px;box-shadow:0 28px 75px rgba(26,29,35,.17)}.rfm-final-grid{position:absolute;inset:0;opacity:.24;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:32px 32px}.rfm-final>div:last-child{position:relative;z-index:2;max-width:850px}.rfm-final h2{margin:18px 0 0;font:630 clamp(42px,5vw,64px)/1 Geist,Inter,sans-serif;letter-spacing:-.05em}.rfm-final p{max-width:760px;margin:18px 0 0;color:rgba(242,244,247,.67);font-size:13px;line-height:23px}.rfm-final-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:25px}.rfm-final-path{display:flex;flex-wrap:wrap;gap:8px;margin-top:25px;color:rgba(236,238,241,.52)}.rfm-final-path span{display:flex;align-items:center;gap:8px;font-size:7px;font-weight:700}

      .rfm-footer{width:min(1240px,calc(100% - 48px));display:grid;grid-template-columns:1.45fr repeat(3,.72fr) 1fr;gap:30px;margin:0 auto;padding:45px 0 52px;border-top:1px solid var(--rfm-line)}.rfm-footer-brand{display:grid;align-content:start;gap:14px}.rfm-footer-brand p{max-width:340px;margin:0;color:var(--rfm-muted);font-size:9px;line-height:16px}.rfm-footer nav{display:grid;align-content:start;gap:9px}.rfm-footer nav strong{margin-bottom:3px;font-size:8px;text-transform:uppercase;letter-spacing:.08em}.rfm-footer nav a{color:#727782;text-decoration:none;font-size:8px}.rfm-footer nav a:hover{color:var(--rfm-primary)}.rfm-footer-trust{display:grid;align-content:start;gap:8px}.rfm-footer-trust span{display:flex;align-items:center;gap:6px;color:#777c86;font-size:7px}.rfm-footer-trust svg{color:var(--rfm-primary)}

      @media(max-width:1180px){
        .rfm-desktop-nav{gap:18px}.rfm-desktop-nav a{font-size:10px}
        .rfm-hero{grid-template-columns:1fr;min-height:auto;padding-top:78px}.rfm-hero-copy{max-width:860px}.rfm-hero-preview-wrap{max-width:900px;width:100%;margin:10px auto 0}.rfm-product-preview{transform:none}
        .rfm-problem-grid{grid-template-columns:1fr 1fr}.rfm-problem-grid article{min-height:220px}.rfm-problem-grid article strong{margin-top:28px}
        .rfm-journey>article,.rfm-journey>article.reverse{grid-template-columns:74px minmax(0,1fr);gap:18px}.rfm-journey>article .rfm-journey-visual,.rfm-journey>article.reverse .rfm-journey-visual{grid-column:1/-1;grid-row:auto;order:initial}.rfm-journey>article.reverse .rfm-journey-index,.rfm-journey>article.reverse .rfm-journey-copy{grid-column:auto}.rfm-journey>article.reverse .rfm-journey-index{grid-column:1}.rfm-journey>article.reverse .rfm-journey-copy{grid-column:2}
        .rfm-agent-grid{grid-template-columns:repeat(3,1fr)}.rfm-agent-grid article:nth-child(4),.rfm-agent-grid article:nth-child(5){grid-column:span 1}
        .rfm-trust-grid{grid-template-columns:1fr 1fr}
        .rfm-footer{grid-template-columns:1.5fr repeat(2,1fr)}.rfm-footer nav:nth-of-type(3),.rfm-footer-trust{margin-top:14px}
      }

      @media(max-width:900px){
        .rfm-desktop-nav{display:none}.rfm-nav{grid-template-columns:1fr auto}.rfm-nav-actions>.rfm-btn{display:none}.rfm-menu-btn{display:grid}
        .rfm-trusted-section{grid-template-columns:1fr;gap:18px}.rfm-audience-pills,.rfm-customer-logos{justify-content:flex-start}
        .rfm-stack-compare{grid-template-columns:1fr}.rfm-stack-compare>article{min-height:auto}.rfm-stack-path{grid-template-columns:repeat(3,1fr);row-gap:18px}.rfm-stack-path>span>svg{display:none}
        .rfm-usecase-grid{grid-template-columns:1fr 1fr}.rfm-usecase-grid article,.rfm-usecase-grid article.featured,.rfm-usecase-grid article:nth-child(2){grid-column:auto}
        .rfm-voice-section{grid-template-columns:1fr;gap:48px}.rfm-voice-demo-wrap{max-width:720px}.rfm-voice-context-card{right:10px}
        .rfm-trust-head{grid-template-columns:1fr}.rfm-trust-seal{max-width:430px}
        .rfm-pricing-grid{grid-template-columns:1fr}.rfm-price-card{min-height:auto}
        .rfm-faq-list{grid-template-columns:1fr}
      }

      @media(max-width:680px){
        .rfm-nav{min-height:66px;padding-inline:16px}.rfm-brand>span{width:34px;height:34px}.rfm-brand strong{font-size:15px}
        .rfm-hero{gap:38px;padding:62px 18px 52px}.rfm-kicker{font-size:8px}.rfm-hero-copy h1{font-size:45px}.rfm-hero-copy>p{font-size:13px;line-height:22px}.rfm-btn.large{width:100%}.rfm-hero-actions{display:grid}.rfm-proof{display:grid;gap:8px}.rfm-preview-caption{justify-self:start}
        .rfm-product-body{grid-template-columns:1fr}.rfm-product-body>aside{display:none}.rfm-product-body>main{padding:12px}.rfm-preview-metrics{grid-template-columns:1fr 1fr}.rfm-preview-content{grid-template-columns:1fr}.rfm-preview-content>section:nth-child(2){display:none}.rfm-preview-table{grid-column:auto}
        .rfm-trusted-section,.rfm-section,.rfm-footer{width:calc(100% - 30px)}.rfm-trusted-section{padding-block:24px}.rfm-audience-pills span{min-height:36px;padding:7px 11px;font-size:9px}
        .rfm-section{padding:72px 0}.rfm-section-head{margin-bottom:30px}.rfm-section-head h2,.rfm-trust-head h2{font-size:37px}.rfm-section-head p,.rfm-trust-head p{font-size:12px;line-height:21px}
        .rfm-problem-grid{grid-template-columns:1fr}.rfm-problem-grid article{min-height:auto}.rfm-bridge-callout{grid-template-columns:1fr}.rfm-bridge-flow{justify-content:flex-start}
        .rfm-stack-inner{padding-block:72px}.rfm-stack-fragmented>div{grid-template-columns:1fr}.rfm-stack-path{grid-template-columns:1fr 1fr}.rfm-stack-compare>article{padding:20px}
        .rfm-journey>article,.rfm-journey>article.reverse{grid-template-columns:1fr;padding:20px}.rfm-journey>article .rfm-journey-index,.rfm-journey>article .rfm-journey-copy,.rfm-journey>article.reverse .rfm-journey-index,.rfm-journey>article.reverse .rfm-journey-copy{grid-column:1}.rfm-journey-index{grid-template-columns:auto 1fr;justify-items:start;align-items:center}.rfm-journey-index>span{order:2}.rfm-journey-copy h3{font-size:22px}.rfm-journey-visual{min-height:220px}.rfm-context-visual{grid-template-columns:1fr}.rfm-pipeline-visual{grid-template-columns:1fr}
        .rfm-usecase-grid{grid-template-columns:1fr}.rfm-usecase-grid article{min-height:auto}.rfm-usecase-grid article.featured{min-height:auto}
        .rfm-voice-section{padding-block:72px}.rfm-voice-copy h2{font-size:39px}.rfm-voice-demo-wrap{padding-bottom:0}.rfm-voice-context-card{position:static;width:100%;margin-top:10px}.rfm-voice-wave{gap:3px}.rfm-voice-wave i{width:3px}.rfm-transcript article{display:grid}.rfm-transcript article>span{width:28px;height:28px}
        .rfm-agent-grid{grid-template-columns:1fr}.rfm-agent-grid article{min-height:auto}.rfm-agent-grid article>small{margin-top:24px}
        .rfm-trust-grid{grid-template-columns:1fr}
        .rfm-final{width:calc(100% - 30px);padding:46px 24px;border-radius:18px}.rfm-final h2{font-size:42px}.rfm-final-actions{display:grid}
        .rfm-footer{grid-template-columns:1fr 1fr;gap:26px}.rfm-footer-brand{grid-column:1/-1}.rfm-footer-trust{grid-column:1/-1}
      }

      @media(max-width:430px){
        .rfm-hero-copy h1{font-size:39px}.rfm-section-head h2,.rfm-trust-head h2{font-size:33px}.rfm-final h2{font-size:38px}.rfm-mobile-actions{grid-template-columns:1fr}.rfm-footer{grid-template-columns:1fr}.rfm-footer nav,.rfm-footer-trust{grid-column:1}
        .rfm-filter-row{display:grid}.rfm-context-visual{padding:14px}.rfm-score-ring{width:105px;height:105px}.rfm-faq-list summary{font-size:11px}
      }



      /* ------------------------------------------------------------------ */
      /* V9 immersive motion layer — Austin Werner-inspired storytelling     */
      /* ------------------------------------------------------------------ */
      .rf-marketing-v8{
        position:relative;
        isolation:isolate;
        background:#0b0d12;
      }
      .rfm-scroll-progress{
        position:fixed;z-index:400;top:0;right:0;left:0;height:2px;
        transform-origin:0 50%;pointer-events:none;
        background:linear-gradient(90deg,#7a7cff,#9d6cff 55%,#55d7ff);
        box-shadow:0 0 18px rgba(122,124,255,.45);
      }
      .rfm-atmosphere{
        position:fixed;z-index:0;inset:-18vh -10vw;overflow:hidden;pointer-events:none;
        background:
          radial-gradient(circle at 12% 18%,rgba(90,93,255,.14),transparent 28%),
          radial-gradient(circle at 84% 28%,rgba(118,63,211,.12),transparent 30%),
          radial-gradient(circle at 52% 88%,rgba(34,184,238,.08),transparent 31%),
          linear-gradient(180deg,#0b0d12 0%,#10131a 46%,#0a0c10 100%);
      }
      .rfm-atmosphere-grid{position:absolute;inset:0;opacity:.28;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:64px 64px;mask-image:radial-gradient(circle at 50% 35%,#000 0 40%,transparent 78%)}
      .rfm-atmosphere-orb{position:absolute;width:44vw;aspect-ratio:1;border-radius:50%;filter:blur(72px);opacity:.28}
      .rfm-atmosphere-orb-a{top:2%;left:-14%;background:#4e55ff}
      .rfm-atmosphere-orb-b{right:-17%;top:42%;background:#7f47d9}
      .rfm-atmosphere-noise{position:absolute;inset:0;opacity:.045;mix-blend-mode:screen;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.8'/%3E%3C/svg%3E")}
      .rfm-nav{background:rgba(11,13,18,.74);border-color:rgba(255,255,255,.075);box-shadow:0 10px 40px rgba(0,0,0,.12);backdrop-filter:blur(22px) saturate(145%)}
      .rfm-nav .rfm-brand strong{color:#fff}.rfm-nav .rfm-brand small{color:#a8aaff}.rfm-desktop-nav a{color:rgba(245,247,255,.62)}.rfm-desktop-nav a:hover{color:#fff}.rfm-nav .rfm-btn.secondary{color:#f7f8fb;background:rgba(255,255,255,.055);border-color:rgba(255,255,255,.12)}.rfm-menu-btn{color:#fff;background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.12)}
      .rfm-hero{min-height:calc(100svh - 72px);padding-top:68px;padding-bottom:94px;background:transparent;border-bottom:1px solid rgba(255,255,255,.07)}
      .rfm-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 70% 42%,rgba(83,86,230,.13),transparent 32%),linear-gradient(180deg,rgba(11,13,18,.16),rgba(11,13,18,.76));pointer-events:none}
      .rfm-hero-grid{opacity:.42;background-size:54px 54px;transform:perspective(700px) rotateX(62deg) scale(1.35);transform-origin:center 78%;mask-image:linear-gradient(transparent 0,#000 24%,transparent 86%)}
      .rfm-hero-glow{filter:blur(34px)}
      .rfm-hero-copy h1{font-size:clamp(56px,6vw,92px);line-height:.92;letter-spacing:-.065em;text-wrap:balance}
      .rfm-hero-copy h1 em{background:linear-gradient(90deg,#b8b9ff 0%,#d8c4ff 55%,#91dcff 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
      .rfm-hero-copy>p{font-size:16px;line-height:27px;color:rgba(241,244,252,.68)}
      .rfm-product-preview{transform:perspective(1200px) rotateY(-4deg) rotateX(2deg);box-shadow:0 44px 120px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.06)}
      .rfm-scroll-cue{position:absolute;z-index:3;left:max(32px,calc((100vw - 1380px)/2));bottom:24px;display:inline-flex;align-items:center;gap:11px;color:rgba(255,255,255,.56);text-decoration:none;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.rfm-scroll-cue i{width:30px;height:30px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.14);border-radius:50%;transform:rotate(90deg);animation:rfmScrollCue 1.8s ease-in-out infinite}.rfm-scroll-cue:hover{color:#fff}
      @keyframes rfmScrollCue{0%,100%{transform:rotate(90deg) translateX(0)}50%{transform:rotate(90deg) translateX(4px)}}
      .rfm-trusted-section{position:relative;z-index:2;margin-top:28px;background:rgba(255,255,255,.97);box-shadow:0 26px 90px rgba(0,0,0,.25)}
      .rfm-problem-section,.rfm-journey-section,.rfm-agents-section,.rfm-pricing-section,.rfm-faq-section{position:relative;z-index:2;margin-block:28px;padding-inline:34px;border:1px solid rgba(255,255,255,.075);border-radius:28px;background:rgba(248,249,251,.965);box-shadow:0 32px 100px rgba(0,0,0,.26);backdrop-filter:blur(18px)}
      .rfm-stack-section,.rfm-voice-chapter,.rfm-trust-section,.rfm-usecase-section{position:relative;z-index:2;border-block:1px solid rgba(255,255,255,.07)}
      .rfm-journey{gap:40px;padding-bottom:20px}
      .rfm-journey>article{position:sticky;top:calc(92px + (var(--rfm-story-index) * 6px));min-height:520px;padding:34px;border-color:rgba(28,31,38,.1);border-radius:24px;box-shadow:0 30px 70px rgba(19,22,29,.13);transform-origin:50% 0}
      .rfm-journey-visual{min-height:330px;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.75)}
      .rfm-usecase-grid>article,.rfm-agent-grid>article,.rfm-trust-grid>article,.rfm-pricing-grid>article{transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s cubic-bezier(.2,.8,.2,1),border-color .35s ease}.rfm-usecase-grid>article:hover,.rfm-agent-grid>article:hover,.rfm-trust-grid>article:hover,.rfm-pricing-grid>article:hover{transform:translateY(-8px);box-shadow:0 28px 66px rgba(26,30,38,.13);border-color:rgba(87,89,223,.28)}
      .rfm-final{position:relative;z-index:2;overflow:hidden;background:linear-gradient(135deg,#222634 0%,#14171d 46%,#1f1630 100%);box-shadow:0 40px 120px rgba(0,0,0,.42)}
      .rfm-final::after{content:"";position:absolute;right:-120px;bottom:-180px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(95,98,245,.28),transparent 68%);pointer-events:none}
      .rfm-footer{position:relative;z-index:2;color:rgba(255,255,255,.7);border-color:rgba(255,255,255,.1)}
      .rfm-footer strong{color:#fff}
      @media(max-width:900px){.rfm-journey>article{position:relative;top:auto;min-height:0}.rfm-hero{min-height:auto}.rfm-scroll-cue{display:none}.rfm-problem-section,.rfm-journey-section,.rfm-agents-section,.rfm-pricing-section,.rfm-faq-section{padding-inline:18px;border-radius:20px}}

            @media(prefers-reduced-motion:reduce){
        .rf-marketing-v8 *,
        .rf-marketing-v8 *::before,
        .rf-marketing-v8 *::after{animation:none!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
      }


      /* ==========================================================
         ReachFly Marketing V10 — cinematic / real 3D art direction
         ========================================================== */
      .rf-marketing-v8{
        --rfm-ink:#07090f;
        --rfm-ink2:#0c0f18;
        --rfm-glass:rgba(16,19,31,.68);
        --rfm-glass-line:rgba(255,255,255,.10);
        background:
          radial-gradient(circle at 15% 8%,rgba(83,86,235,.18),transparent 24%),
          radial-gradient(circle at 84% 18%,rgba(146,66,255,.15),transparent 25%),
          linear-gradient(180deg,#07090f 0%,#0a0c13 42%,#07090f 100%);
      }
      .rfm-atmosphere{opacity:.8;filter:saturate(1.1)}
      .rfm-atmosphere-grid{background-size:72px 72px;opacity:.18;mask-image:linear-gradient(to bottom,#000,transparent 82%)}
      .rfm-nav{background:rgba(7,9,15,.58)!important;border-color:rgba(255,255,255,.075)!important;box-shadow:0 14px 42px rgba(0,0,0,.18);backdrop-filter:blur(22px) saturate(1.4)}

      .rfm-hero{
        min-height:100svh;
        padding-top:90px;
        overflow:hidden;
        isolation:isolate;
        perspective:1800px;
        background:transparent!important;
      }
      .rfm-hero::after{
        content:"";position:absolute;inset:auto 0 0;height:28%;pointer-events:none;z-index:0;
        background:linear-gradient(to bottom,transparent,#07090f 88%);
      }
      .rfm-hero-3d{position:absolute;inset:-7% -8% -8% 36%;z-index:0;opacity:.86;pointer-events:none;filter:saturate(1.18) contrast(1.03);transition:opacity .4s ease}
      .rfm-hero-3d canvas{width:100%!important;height:100%!important}
      .rfm-hero-grid{opacity:.16!important;background-size:74px 74px!important;transform:perspective(900px) rotateX(68deg) scale(1.55)!important;transform-origin:center 82%!important}
      .rfm-hero-copy{position:relative;z-index:3;max-width:650px;padding-top:3vh}
      .rfm-kicker{background:rgba(255,255,255,.055)!important;border:1px solid rgba(255,255,255,.11)!important;box-shadow:inset 0 1px rgba(255,255,255,.08);backdrop-filter:blur(14px)}
      .rfm-hero-copy h1{max-width:720px;font-size:clamp(54px,6.3vw,102px)!important;line-height:.91!important;letter-spacing:-.064em!important;text-wrap:balance}
      .rfm-hero-copy h1 em{font-style:normal;color:transparent!important;background:linear-gradient(105deg,#fff 0%,#b9baff 38%,#8f76ff 68%,#df91ff 100%);background-clip:text;-webkit-background-clip:text;filter:drop-shadow(0 10px 34px rgba(103,87,255,.16))}
      .rfm-hero-copy>p{max-width:610px!important;font-size:clamp(14px,1.2vw,18px)!important;line-height:1.72!important;color:rgba(239,241,247,.66)!important}
      .rfm-btn.primary{position:relative;overflow:hidden;box-shadow:0 12px 38px rgba(89,83,238,.28),inset 0 1px rgba(255,255,255,.26)}
      .rfm-btn.primary::before{content:"";position:absolute;inset:-80% -20%;background:linear-gradient(105deg,transparent 34%,rgba(255,255,255,.32) 49%,transparent 64%);transform:translateX(-70%) rotate(8deg);transition:transform .7s cubic-bezier(.2,.8,.2,1)}
      .rfm-btn.primary:hover::before{transform:translateX(70%) rotate(8deg)}
      .rfm-proof{border-color:rgba(255,255,255,.08)!important;color:rgba(232,234,242,.62)!important}

      .rfm-hero-preview-wrap{
        --rfm-pointer-rx:0;--rfm-pointer-ry:0;
        position:relative;z-index:4;perspective:1600px;transform-style:preserve-3d;
        transform:rotateX(calc(var(--rfm-pointer-rx) * 1deg)) rotateY(calc(var(--rfm-pointer-ry) * 1deg));
        transition:filter .35s ease;
      }
      .rfm-product-preview{
        position:relative!important;overflow:visible!important;transform-style:preserve-3d!important;
        border:1px solid rgba(255,255,255,.16)!important;background:rgba(245,246,250,.96)!important;
        box-shadow:0 70px 160px rgba(0,0,0,.58),0 24px 60px rgba(19,20,45,.38),0 0 0 1px rgba(123,125,255,.11)!important;
      }
      .rfm-product-preview::before,.rfm-product-preview::after{content:"";position:absolute;pointer-events:none;border-radius:inherit}
      .rfm-product-preview::before{inset:10px -18px -18px 18px;z-index:-1;background:linear-gradient(145deg,rgba(91,94,239,.28),rgba(123,64,224,.05));transform:translateZ(-55px);filter:blur(.2px)}
      .rfm-product-preview::after{inset:-1px;background:linear-gradient(115deg,rgba(255,255,255,.42),transparent 18%,transparent 72%,rgba(111,86,255,.16));mix-blend-mode:screen;opacity:.62}
      .rfm-product-body{transform-style:preserve-3d}.rfm-product-body>aside{transform:translateZ(18px)}.rfm-product-body>main{transform:translateZ(30px)}
      .rfm-float-signal{position:absolute;z-index:8;display:flex;align-items:center;gap:9px;min-width:150px;padding:10px 12px;color:#f7f8ff;background:rgba(15,18,30,.76);border:1px solid rgba(255,255,255,.12);border-radius:13px;box-shadow:0 18px 42px rgba(0,0,0,.34);backdrop-filter:blur(18px) saturate(1.35);transform-style:preserve-3d}
      .rfm-float-signal>span{width:29px;height:29px;display:grid;place-items:center;color:#c7c8ff;background:rgba(95,98,238,.22);border:1px solid rgba(143,145,255,.22);border-radius:9px}
      .rfm-float-signal>div{display:grid;gap:1px}.rfm-float-signal small{font-size:7px;color:#9196a8;text-transform:uppercase;letter-spacing:.08em}.rfm-float-signal strong{font-size:9px;font-weight:750;white-space:nowrap}
      .signal-a{right:-54px;top:14%;transform:translateZ(82px)}.signal-b{left:-58px;bottom:23%;transform:translateZ(100px)}.signal-c{right:-34px;bottom:-12px;transform:translateZ(68px)}
      .rfm-scroll-cue{z-index:6!important}

      .rfm-trusted-section{position:relative;z-index:4;background:rgba(7,9,15,.72)!important;border-color:rgba(255,255,255,.07)!important;overflow:hidden;backdrop-filter:blur(18px)}
      .rfm-trusted-copy strong{color:#f4f5fb!important}.rfm-trusted-copy>span{color:#8f91ff!important}
      .rfm-audience-marquee{min-width:0;overflow:hidden;mask-image:linear-gradient(to right,transparent,#000 8%,#000 92%,transparent)}
      .rfm-audience-marquee-track{display:flex;width:max-content;align-items:center;gap:30px;will-change:transform}
      .rfm-audience-marquee span{display:flex;align-items:center;gap:30px;color:#b7bac7;font-size:11px;font-weight:720;white-space:nowrap;text-transform:uppercase;letter-spacing:.12em}
      .rfm-audience-marquee i{width:5px;height:5px;border-radius:50%;background:#6568ef;box-shadow:0 0 18px #7a7cff}

      .rfm-problem-section{position:relative;color:#f7f7fb;background:transparent!important;padding-top:130px!important;padding-bottom:120px!important}
      .rfm-problem-section::before{content:"CONTEXT";position:absolute;top:50px;left:50%;transform:translateX(-50%);font:800 clamp(82px,15vw,230px)/1 Geist,Inter,sans-serif;letter-spacing:-.08em;color:rgba(255,255,255,.018);pointer-events:none}
      .rfm-problem-section .rfm-section-head h2,.rfm-problem-section .rfm-section-head p{color:inherit!important}.rfm-problem-section .rfm-section-head p{color:rgba(236,238,245,.58)!important}
      .rfm-problem-grid{gap:0!important;border-block:1px solid rgba(255,255,255,.09);background:transparent!important}
      .rfm-problem-grid>article{min-height:260px!important;padding:36px 28px!important;background:transparent!important;border:0!important;border-right:1px solid rgba(255,255,255,.08)!important;border-radius:0!important;box-shadow:none!important;transform-style:preserve-3d}
      .rfm-problem-grid>article:last-child{border-right:0!important}.rfm-problem-grid>article>span{background:rgba(95,98,238,.14)!important;border:1px solid rgba(133,136,255,.18)!important}.rfm-problem-grid strong{color:#f7f8fb!important;font-size:17px!important}.rfm-problem-grid p{color:rgba(228,231,239,.52)!important;font-size:10px!important;line-height:1.75!important}
      .rfm-problem-grid>article:hover{background:linear-gradient(180deg,rgba(90,92,235,.075),rgba(255,255,255,.015))!important;transform:translateY(-8px) rotateX(2deg)!important}
      .rfm-bridge-callout{color:#eef0f8!important;background:linear-gradient(130deg,rgba(85,88,236,.14),rgba(124,65,218,.06))!important;border:1px solid rgba(255,255,255,.1)!important;box-shadow:inset 0 1px rgba(255,255,255,.06),0 30px 80px rgba(0,0,0,.18)!important;backdrop-filter:blur(16px)}
      .rfm-bridge-callout h3{color:#fff!important}.rfm-bridge-flow b{color:#e8e9f5!important}

      .rfm-stack-section{min-height:100svh!important;display:grid;align-items:center;background:radial-gradient(circle at 72% 42%,rgba(91,93,239,.18),transparent 30%),linear-gradient(180deg,#10131a,#0c0f15)!important;perspective:1600px;overflow:hidden}
      .rfm-stack-inner{padding-block:84px!important}.rfm-stack-compare{transform-style:preserve-3d}.rfm-stack-fragmented,.rfm-stack-reachfly{min-height:430px!important;border-color:rgba(255,255,255,.08)!important;box-shadow:0 35px 90px rgba(0,0,0,.25)!important;backdrop-filter:blur(20px)}
      .rfm-stack-fragmented{background:rgba(255,255,255,.035)!important}.rfm-stack-reachfly{background:linear-gradient(145deg,rgba(255,255,255,.97),rgba(237,238,255,.94))!important;transform-style:preserve-3d}
      .rfm-stack-reachfly>*{transform:translateZ(25px)}

      .rfm-journey-section{padding-top:130px!important;background:linear-gradient(180deg,#080a10,#0c0f17)!important;color:#f5f6fb}
      .rfm-journey-section .rfm-section-head h2{color:#fff!important}.rfm-journey-section .rfm-section-head p{color:rgba(234,236,243,.56)!important}
      .rfm-journey>article{min-height:610px!important;overflow:hidden!important;color:#f7f8fb!important;background:linear-gradient(140deg,rgba(21,25,37,.94),rgba(13,16,26,.88))!important;border:1px solid rgba(255,255,255,.09)!important;border-radius:30px!important;box-shadow:0 38px 90px rgba(0,0,0,.32)!important;backdrop-filter:blur(24px);transform-style:preserve-3d}
      .rfm-journey>article::before{content:attr(style);display:none}
      .rfm-journey>article::after{content:"";position:absolute;width:460px;height:460px;right:-140px;top:-160px;border-radius:50%;background:radial-gradient(circle,rgba(90,92,238,.17),transparent 68%);pointer-events:none}
      .rfm-journey-copy h3{color:#fff!important;font-size:clamp(27px,3vw,44px)!important;line-height:1.03!important;letter-spacing:-.045em!important}.rfm-journey-copy p{color:rgba(232,234,241,.58)!important;font-size:11px!important;line-height:1.85!important}.rfm-journey-copy em{color:#aeb1c1!important;border-color:rgba(255,255,255,.08)!important;background:rgba(255,255,255,.04)!important}
      .rfm-journey-index>span{font-size:56px!important;color:rgba(255,255,255,.10)!important}.rfm-journey-index>i{background:rgba(91,94,239,.18)!important;border:1px solid rgba(131,134,255,.22)!important}
      .rfm-journey-visual{background:linear-gradient(145deg,rgba(246,247,251,.97),rgba(232,234,244,.94))!important;border-color:rgba(255,255,255,.25)!important;box-shadow:0 32px 70px rgba(0,0,0,.34)!important;transform-style:preserve-3d}.rfm-journey-visual>*{transform:translateZ(18px)}

      .rfm-usecase-section{overflow:hidden!important;background:linear-gradient(180deg,#0b0e15,#07090f)!important;border-color:rgba(255,255,255,.07)!important;color:#f5f6fb}
      .rfm-usecase-section>.rfm-section{width:100%!important;max-width:none!important;padding:100px max(32px,calc((100vw - 1240px)/2)) 88px!important;overflow:visible!important}
      .rfm-usecase-section .rfm-section-head{max-width:760px}.rfm-usecase-section .rfm-section-head h2{color:#fff!important}.rfm-usecase-section .rfm-section-head p{color:rgba(232,234,242,.56)!important}
      .rfm-usecase-grid{display:flex!important;width:max-content!important;gap:18px!important;transform-style:preserve-3d;will-change:transform}
      .rfm-usecase-grid>article,.rfm-usecase-grid>article.featured,.rfm-usecase-grid>article:nth-child(2){width:min(440px,72vw)!important;min-height:480px!important;flex:0 0 auto!important;color:#f7f8fb!important;background:linear-gradient(145deg,rgba(24,28,42,.92),rgba(13,16,26,.88))!important;border:1px solid rgba(255,255,255,.09)!important;border-radius:24px!important;box-shadow:0 35px 85px rgba(0,0,0,.24)!important;backdrop-filter:blur(18px);transform-style:preserve-3d}
      .rfm-usecase-grid>article:nth-child(2n){background:linear-gradient(145deg,rgba(52,48,91,.78),rgba(16,18,31,.9))!important}.rfm-usecase-grid h3{font-size:30px!important;line-height:1.05!important}.rfm-usecase-grid p,.rfm-usecase-grid li{color:rgba(229,231,239,.58)!important}.rfm-usecase-grid header>span{transform:translateZ(30px);box-shadow:0 10px 32px rgba(70,72,212,.15)}
      .rfm-usecase-grid>article:hover{transform:translateY(-14px) rotateX(2deg) rotateY(-2deg)!important;border-color:rgba(132,134,255,.30)!important;box-shadow:0 48px 110px rgba(0,0,0,.38)!important}

      .rfm-voice-chapter{background:radial-gradient(circle at 78% 35%,rgba(79,82,229,.2),transparent 32%),linear-gradient(180deg,#090b12,#11141c)!important}
      .rfm-voice-demo-wrap{perspective:1400px}.rfm-voice-demo{transform:rotateY(-4deg) rotateX(2deg);transform-style:preserve-3d;box-shadow:0 48px 100px rgba(0,0,0,.38)!important}.rfm-voice-demo>*{transform:translateZ(20px)}
      .rfm-agent-section,.rfm-trust-section{background:transparent!important;color:#f6f7fb}.rfm-agent-section .rfm-section-head h2,.rfm-trust-section .rfm-section-head h2{color:#fff!important}.rfm-agent-section .rfm-section-head p,.rfm-trust-section .rfm-section-head p{color:rgba(232,234,241,.55)!important}
      .rfm-agent-grid>article,.rfm-trust-grid>article{color:#f3f4fa!important;background:rgba(18,22,34,.72)!important;border-color:rgba(255,255,255,.08)!important;box-shadow:0 22px 60px rgba(0,0,0,.18)!important;backdrop-filter:blur(18px)}
      .rfm-agent-grid>article p,.rfm-trust-grid>article p{color:rgba(228,230,238,.52)!important}

      .rfm-pricing-section,.rfm-faq{position:relative;z-index:3;background:#f2f3f7!important;border-radius:34px!important;margin:24px auto!important;width:min(100% - 34px,1320px)!important;box-shadow:0 42px 100px rgba(0,0,0,.28)!important}
      .rfm-pricing-section .rfm-section,.rfm-faq{padding-inline:clamp(24px,5vw,70px)!important}
      .rfm-final{border:1px solid rgba(255,255,255,.1)!important;background:radial-gradient(circle at 80% 30%,rgba(104,75,255,.24),transparent 28%),linear-gradient(135deg,#11141e,#090b12)!important;box-shadow:0 44px 110px rgba(0,0,0,.38)!important}

      @media(max-width:1100px){
        .rfm-hero-3d{inset:-5% -20% 2% 28%;opacity:.55}.signal-a{right:-12px}.signal-b{left:-8px}.signal-c{right:8px}
      }
      @media(max-width:900px){
        .rfm-hero{min-height:auto!important}.rfm-hero-3d{inset:3% -40% 38% 12%;opacity:.42}.rfm-hero-copy h1{font-size:clamp(46px,12vw,72px)!important}.rfm-hero-preview-wrap{transform:none!important}.rfm-float-signal{display:none}.rfm-problem-grid{grid-template-columns:1fr 1fr!important}.rfm-problem-grid>article{border-bottom:1px solid rgba(255,255,255,.08)!important}.rfm-usecase-grid{display:grid!important;width:auto!important;transform:none!important}.rfm-usecase-grid>article,.rfm-usecase-grid>article.featured,.rfm-usecase-grid>article:nth-child(2){width:auto!important;min-height:auto!important}.rfm-pricing-section,.rfm-faq{width:calc(100% - 20px)!important;border-radius:24px!important}
      }
      @media(max-width:620px){
        .rfm-hero-3d{inset:2% -60% 48% -8%;opacity:.3}.rfm-problem-grid{grid-template-columns:1fr!important}.rfm-problem-grid>article{border-right:0!important}.rfm-journey>article{min-height:auto!important;border-radius:20px!important}.rfm-usecase-section>.rfm-section{padding-inline:18px!important}
      }
      @media(prefers-reduced-motion:reduce){.rfm-hero-3d{opacity:.32}.rfm-audience-marquee-track{transform:none!important}.rfm-product-preview,.rfm-hero-preview-wrap{transform:none!important}}

    `}</style>
  );
}
