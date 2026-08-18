import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  Brain,
  CalendarCheck2,
  Check,
  ChevronRight,
  Menu,
  MessageCircleMore,
  PhoneCall,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import BrandLogo from "../components/BrandLogo";
import { useSEO } from "../seo";
import "../styles.css";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4";

const SERVICE_OPTIONS = [
  "Lead discovery",
  "AI Voice",
  "Outbound workflow",
  "Other",
];

const WORKFLOW = [
  {
    icon: Radar,
    number: "01",
    title: "Discover",
    text: "Choose the market, niche, or territory you want to pursue and turn it into focused business prospects.",
  },
  {
    icon: Brain,
    number: "02",
    title: "Understand",
    text: "Add website and business context so your team knows why a prospect may care before the first touch.",
  },
  {
    icon: PhoneCall,
    number: "03",
    title: "Converse",
    text: "Give AI Voice the lead context, objective, and instructions needed to have a more relevant conversation.",
  },
  {
    icon: CalendarCheck2,
    number: "04",
    title: "Advance",
    text: "Keep outcomes, follow-up, meetings, ownership, and pipeline state attached to the same opportunity.",
  },
];

const USE_CASES = [
  {
    icon: Target,
    label: "Agencies",
    title: "Turn local businesses into qualified opportunities.",
    text: "Discover the right companies, understand the opportunity, start relevant outreach, and keep booked meetings connected.",
    href: "/local-lead-generation-tool",
  },
  {
    icon: Zap,
    label: "B2B sales",
    title: "Give outbound more context before the first touch.",
    text: "Build targeted account lists, enrich the lead with useful context, and coordinate AI-assisted conversations and follow-up.",
    href: "/ai-lead-generation-crm",
  },
  {
    icon: Users,
    label: "Founders & lean teams",
    title: "Run one sales motion without stitching together six tools.",
    text: "Use one workspace for prospecting, AI Voice, follow-up, meetings, ownership, and pipeline activity.",
    href: "/ai-marketing-software",
  },
];

const TRUST_POINTS = [
  {
    icon: ShieldCheck,
    title: "Human oversight",
    text: "Keep agent behavior, activity, and important workflow decisions visible to your team.",
  },
  {
    icon: Workflow,
    title: "One connected timeline",
    text: "Calls, follow-up, meetings, and next actions stay attached to the prospect instead of living in separate tabs.",
  },
  {
    icon: MessageCircleMore,
    title: "Context survives every touch",
    text: "Your team does not have to rebuild the prospect story after every conversation or channel change.",
  },
];

const AUDIENCES = ["Agencies", "B2B SaaS", "Local sales", "Growth teams", "Founders"];

function useTypewriter(text, speed = 38, startDelay = 500) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);

    let timer;
    let interval;

    timer = window.setTimeout(() => {
      let index = 0;
      interval = window.setInterval(() => {
        index += 1;
        setDisplayed(text.slice(0, index));

        if (index >= text.length) {
          window.clearInterval(interval);
          setDone(true);
        }
      }, speed);
    }, startDelay);

    return () => {
      window.clearTimeout(timer);
      if (interval) window.clearInterval(interval);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}

function useLenis() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.05,
      smoothWheel: true,
      wheelMultiplier: 0.88,
      touchMultiplier: 1,
    });

    let rafId = 0;

    const raf = (time) => {
      lenis.raf(time);
      rafId = window.requestAnimationFrame(raf);
    };

    rafId = window.requestAnimationFrame(raf);

    return () => {
      window.cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);
}

function BackgroundVideo({ layerRef }) {
  const videoRef = useRef(null);
  const previousX = useRef(null);
  const targetTime = useRef(0);
  const seeking = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const initializeDesktopFrame = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;

      if (window.innerWidth >= 1024) {
        video.pause();
        targetTime.current = Math.min(video.duration * 0.18, video.duration);
        try {
          video.currentTime = targetTime.current;
        } catch {
          targetTime.current = 0;
        }
      }
    };

    const seekToTarget = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      if (window.innerWidth < 1024) return;

      const next = clamp(targetTime.current, 0, video.duration);
      if (Math.abs(video.currentTime - next) < 0.015) {
        seeking.current = false;
        return;
      }

      seeking.current = true;
      try {
        video.currentTime = next;
      } catch {
        seeking.current = false;
      }
    };

    const onSeeked = () => {
      seeking.current = false;
      if (
        window.innerWidth >= 1024 &&
        Math.abs(video.currentTime - targetTime.current) > 0.02
      ) {
        seekToTarget();
      }
    };

    const onMouseMove = (event) => {
      if (window.innerWidth < 1024) {
        previousX.current = null;
        return;
      }

      if (!Number.isFinite(video.duration) || video.duration <= 0) return;

      if (previousX.current === null) {
        previousX.current = event.clientX;
        targetTime.current = video.currentTime || targetTime.current || 0;
        return;
      }

      const delta = event.clientX - previousX.current;
      previousX.current = event.clientX;

      targetTime.current = clamp(
        targetTime.current +
          (delta / Math.max(window.innerWidth, 1)) * 0.8 * video.duration,
        0,
        video.duration
      );

      if (!seeking.current) seekToTarget();
    };

    const resetPointer = () => {
      previousX.current = null;
    };

    const configurePlayback = () => {
      if (window.innerWidth < 1024) {
        previousX.current = null;
        video.autoplay = true;
        video.loop = true;
        video.play().catch(() => {});
      } else {
        video.autoplay = false;
        video.loop = false;
        video.pause();
      }
    };

    video.addEventListener("loadedmetadata", initializeDesktopFrame);
    video.addEventListener("loadedmetadata", configurePlayback);
    video.addEventListener("canplay", configurePlayback);
    video.addEventListener("seeked", onSeeked);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseleave", resetPointer, { passive: true });
    window.addEventListener("blur", resetPointer);
    window.addEventListener("resize", configurePlayback, { passive: true });

    if (video.readyState >= 1) {
      initializeDesktopFrame();
      configurePlayback();
    }

    return () => {
      video.removeEventListener("loadedmetadata", initializeDesktopFrame);
      video.removeEventListener("loadedmetadata", configurePlayback);
      video.removeEventListener("canplay", configurePlayback);
      video.removeEventListener("seeked", onSeeked);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", resetPointer);
      window.removeEventListener("blur", resetPointer);
      window.removeEventListener("resize", configurePlayback);
    };
  }, []);

  return (
    <div ref={layerRef} className="rf14-video-layer" aria-hidden="true">
      <video
        ref={videoRef}
        className="rf14-video"
        muted
        playsInline
        preload="auto"
      >
        <source src={VIDEO_URL} type="video/mp4" />
      </video>
      <div className="rf14-video-left-wash" />
      <div className="rf14-video-edge-wash" />
      <div className="rf14-video-grain" />
    </div>
  );
}


function useCharacterScrollMotion(layerRef) {
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || typeof window === "undefined") return undefined;

    gsap.registerPlugin(ScrollTrigger);

    const hero = document.querySelector(".rf14-hero");
    const workflow = document.querySelector(".rf14-workflow-section");
    const leftWash = layer.querySelector(".rf14-video-left-wash");
    const edgeWash = layer.querySelector(".rf14-video-edge-wash");

    if (!hero || !workflow) return undefined;

    const mm = gsap.matchMedia();

    mm.add(
      "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
      () => {
        gsap.set(layer, {
          xPercent: 0,
          yPercent: 0,
          scale: 1,
          opacity: 1,
          filter: "saturate(1) contrast(1)",
          transformOrigin: "78% 50%",
          force3D: true,
        });

        const heroTimeline = gsap.timeline({
          scrollTrigger: {
            trigger: hero,
            start: "top top",
            end: "bottom top",
            scrub: 1.15,
            invalidateOnRefresh: true,
          },
        });

        heroTimeline.to(layer, {
          xPercent: 7,
          yPercent: -1.5,
          scale: 0.9,
          ease: "none",
          force3D: true,
        });

        const sectionTimeline = gsap.timeline({
          scrollTrigger: {
            trigger: workflow,
            start: "top 96%",
            end: "top 18%",
            scrub: 1.2,
            invalidateOnRefresh: true,
            onEnter: () => layer.classList.add("is-section-background"),
            onEnterBack: () => layer.classList.add("is-section-background"),
            onLeaveBack: () => layer.classList.remove("is-section-background"),
          },
        });

        sectionTimeline
          .to(
            layer,
            {
              xPercent: 21,
              yPercent: 6,
              scale: 0.67,
              opacity: 0.31,
              filter: "saturate(.72) contrast(.94)",
              ease: "power2.inOut",
              force3D: true,
            },
            0
          )
          .to(
            leftWash,
            {
              opacity: 0,
              ease: "power2.inOut",
            },
            0
          )
          .to(
            edgeWash,
            {
              opacity: 0.08,
              ease: "power2.inOut",
            },
            0
          );

        gsap.to(layer, {
          opacity: 0,
          yPercent: 10,
          scale: 0.61,
          ease: "none",
          scrollTrigger: {
            trigger: workflow,
            start: "62% center",
            end: "bottom 22%",
            scrub: 1.05,
            invalidateOnRefresh: true,
            onLeave: () => layer.classList.remove("is-section-background"),
            onEnterBack: () => layer.classList.add("is-section-background"),
          },
        });

        return () => {
          layer.classList.remove("is-section-background");
        };
      }
    );

    mm.add("(max-width: 1023px)", () => {
      gsap.set(layer, {
        clearProps: "transform,opacity,filter",
      });
      layer.classList.remove("is-section-background");
    });

    const refreshId = window.requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      window.cancelAnimationFrame(refreshId);
      mm.revert();
    };
  }, [layerRef]);
}

function CharacterMotionStyles() {
  return (
    <style>{`
      /*
       * ReachFly V14.1 — single-file character motion refinement.
       * This intentionally lives in Marketing.jsx so no CSS file needs changing.
       */
      .rf14-page{
        position:relative;
        isolation:isolate;
      }

      .rf14-video-layer{
        position:fixed!important;
        inset:0!important;
        z-index:0!important;
        width:100vw!important;
        height:100svh!important;
        overflow:hidden!important;
        pointer-events:none!important;
        will-change:transform,opacity,filter;
        transform-origin:78% 50%;
      }

      .rf14-video{
        width:100%!important;
        height:100%!important;
        object-fit:cover!important;
        object-position:80% 49%!important;
        transform:translate3d(8.5%,0,0) scale(.84)!important;
        transform-origin:78% 50%!important;
        will-change:transform;
        background:#f7f7f4!important;
      }

      .rf14-video-left-wash{
        background:
          linear-gradient(
            90deg,
            rgba(255,255,255,1) 0%,
            rgba(255,255,255,.995) 28%,
            rgba(255,255,255,.97) 40%,
            rgba(255,255,255,.78) 50%,
            rgba(255,255,255,.30) 60%,
            rgba(255,255,255,0) 72%
          )!important;
      }

      .rf14-video-edge-wash{
        background:
          radial-gradient(circle at 12% 50%,rgba(255,255,255,.72),transparent 42%),
          linear-gradient(180deg,rgba(255,255,255,.06),transparent 58%,rgba(255,255,255,.14))!important;
      }

      .rf14-video-layer.is-section-background .rf14-video{
        mix-blend-mode:multiply;
      }

      .rf14-video-layer.is-section-background .rf14-video-grain{
        opacity:.025!important;
      }

      .rf14-hero{
        position:relative!important;
        z-index:1!important;
        background:transparent!important;
        min-height:96svh!important;
      }

      .rf14-hero::before{
        content:"";
        position:absolute;
        inset:0;
        z-index:-1;
        pointer-events:none;
        background:
          linear-gradient(90deg,rgba(255,255,255,.28),rgba(255,255,255,0) 62%);
      }

      .rf14-hero-inner{
        width:min(1260px,calc(100% - 72px))!important;
        padding-top:112px!important;
        padding-bottom:76px!important;
      }

      .rf14-hero-copy{
        width:min(585px,41vw)!important;
        max-width:585px!important;
        position:relative;
        z-index:4;
      }

      .rf14-hero h1{
        max-width:585px!important;
        font-size:clamp(50px,5.15vw,78px)!important;
      }

      .rf14-hero-subtitle{
        max-width:545px!important;
      }

      .rf14-scroll-cue{
        z-index:5!important;
      }

      .rf14-audience-strip{
        position:relative;
        z-index:3;
        background:rgba(255,255,255,.97)!important;
        backdrop-filter:blur(12px);
        -webkit-backdrop-filter:blur(12px);
      }

      .rf14-workflow-section{
        position:relative;
        z-index:1;
        isolation:isolate;
        background:
          linear-gradient(
            90deg,
            rgba(243,246,241,.985) 0%,
            rgba(243,246,241,.97) 38%,
            rgba(243,246,241,.86) 63%,
            rgba(243,246,241,.76) 100%
          )!important;
        overflow:hidden;
      }

      .rf14-workflow-section::before{
        content:"";
        position:absolute;
        inset:0;
        z-index:-1;
        pointer-events:none;
        background:
          linear-gradient(180deg,rgba(255,255,255,.34),transparent 28%,rgba(255,255,255,.22)),
          radial-gradient(circle at 86% 36%,rgba(111,102,255,.055),transparent 30%);
      }

      .rf14-workflow-section .rf14-section-width{
        position:relative;
        z-index:2;
      }

      .rf14-workflow-section .rf14-section-head{
        max-width:720px!important;
      }

      .rf14-workflow-grid{
        background:rgba(246,248,245,.70);
        backdrop-filter:blur(7px);
        -webkit-backdrop-filter:blur(7px);
      }

      .rf14-workflow-card{
        background:rgba(246,248,245,.46)!important;
      }

      .rf14-workflow-card:hover{
        background:rgba(255,255,255,.82)!important;
      }

      .rf14-voice-section,
      .rf14-usecase-section,
      .rf14-trust-section,
      .rf14-final-wrap,
      .rf14-footer{
        position:relative;
        z-index:4;
      }

      @media (min-width:1024px) and (max-width:1240px){
        .rf14-hero-inner{
          width:min(1180px,calc(100% - 56px))!important;
        }

        .rf14-hero-copy{
          width:min(545px,44vw)!important;
        }

        .rf14-video{
          object-position:82% 48%!important;
          transform:translate3d(10%,0,0) scale(.80)!important;
        }
      }

      @media (max-width:1023px){
        .rf14-video-layer{
          position:absolute!important;
          top:0!important;
          bottom:auto!important;
          height:100svh!important;
        }

        .rf14-video{
          object-position:70% 46%!important;
          transform:translate3d(16%,1%,0) scale(.78)!important;
        }

        .rf14-video-left-wash{
          background:
            linear-gradient(
              90deg,
              rgba(255,255,255,.99) 0%,
              rgba(255,255,255,.96) 42%,
              rgba(255,255,255,.58) 62%,
              rgba(255,255,255,.08) 82%
            )!important;
        }

        .rf14-hero-inner{
          width:min(100% - 40px,760px)!important;
        }

        .rf14-hero-copy{
          width:min(590px,76vw)!important;
          max-width:590px!important;
        }

        .rf14-workflow-section{
          background:var(--rf14-soft)!important;
        }

        .rf14-workflow-grid{
          backdrop-filter:none;
          -webkit-backdrop-filter:none;
        }
      }

      @media (max-width:680px){
        .rf14-video{
          object-position:66% 36%!important;
          transform:translate3d(24%,4%,0) scale(.68)!important;
          opacity:.70;
        }

        .rf14-video-left-wash{
          background:
            linear-gradient(
              180deg,
              rgba(255,255,255,.98) 0%,
              rgba(255,255,255,.92) 48%,
              rgba(255,255,255,.50) 70%,
              rgba(255,255,255,.12) 100%
            )!important;
        }

        .rf14-hero-copy{
          width:100%!important;
        }
      }

      @media (prefers-reduced-motion:reduce){
        .rf14-video-layer{
          transform:none!important;
        }
      }
    `}</style>
  );
}

function Navbar({ open, setOpen }) {
  const [lightText, setLightText] = useState(false);

  useEffect(() => {
    const updateTone = () => {
      const probeY = 34;
      const darkSections = Array.from(
        document.querySelectorAll('[data-nav-tone="light"]')
      );

      setLightText(
        darkSections.some((section) => {
          const rect = section.getBoundingClientRect();
          return rect.top <= probeY && rect.bottom > probeY;
        })
      );
    };

    updateTone();
    window.addEventListener("scroll", updateTone, { passive: true });
    window.addEventListener("resize", updateTone, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateTone);
      window.removeEventListener("resize", updateTone);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);

  return (
    <>
      <header className={`rf14-nav ${lightText && !open ? "is-light" : "is-dark"}`}>
        <Link to="/" className="rf14-brand" aria-label="ReachFly home">
          <BrandLogo size={34} />
          <strong>ReachFly</strong>
          <small>AI</small>
        </Link>

        <nav className="rf14-nav-links" aria-label="Landing navigation">
          <a href="#how">How it works</a>
          <span>·</span>
          <a href="#voice">AI Voice</a>
          <span>·</span>
          <a href="#use-cases">Use cases</a>
          <span>·</span>
          <a href="#trust">Trust</a>
        </nav>

        <div className="rf14-nav-actions">
          <Link to="/login" className="rf14-nav-signin">
            Sign in
          </Link>
          <Link to="/signup" className="rf14-nav-cta">
            Get started
            <ArrowRight size={15} />
          </Link>
        </div>

        <button
          type="button"
          className="rf14-menu-button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X size={24} /> : <Menu size={25} />}
        </button>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="rf14-mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <motion.nav
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              transition={{ duration: 0.28 }}
            >
              {[
                ["#how", "How it works"],
                ["#voice", "AI Voice"],
                ["#use-cases", "Use cases"],
                ["#trust", "Trust"],
              ].map(([href, label]) => (
                <a key={href} href={href} onClick={() => setOpen(false)}>
                  {label}
                  <ChevronRight size={22} />
                </a>
              ))}
            </motion.nav>

            <div className="rf14-mobile-actions">
              <Link to="/login" onClick={() => setOpen(false)}>
                Sign in
              </Link>
              <Link to="/signup" onClick={() => setOpen(false)}>
                Create workspace
                <ArrowRight size={17} />
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function Reveal({ children, className = "", delay = 0 }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 26 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{
        duration: reduceMotion ? 0 : 0.62,
        delay: reduceMotion ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

function Hero() {
  const [services, setServices] = useState([]);
  const { displayed, done } = useTypewriter(
    "turn the right businesses\ninto real conversations.",
    38,
    500
  );

  const target = useMemo(
    () =>
      services.length
        ? `/signup?interests=${encodeURIComponent(services.join(","))}`
        : "/signup",
    [services]
  );

  const toggle = (service) => {
    setServices((current) =>
      current.includes(service)
        ? current.filter((item) => item !== service)
        : [...current, service]
    );
  };

  return (
    <section className="rf14-hero">
      <div className="rf14-hero-inner">
        <motion.div
          className="rf14-hero-copy"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="rf14-kicker">
            <Sparkles size={14} />
            AI sales workspace · from market to meeting
          </span>

          <h1>
            {displayed}
            {!done ? <i className="rf14-type-cursor animate-blink" /> : null}
          </h1>

          <p className="rf14-hero-subtitle">
            ReachFly helps you discover focused businesses, understand why they may
            care, start contextual AI Voice conversations, and keep every next step
            connected.
          </p>

          <div className="rf14-hero-actions">
            <Link to="/signup" className="rf14-primary-button">
              Create workspace
              <ArrowRight size={17} />
            </Link>
            <a href="#how" className="rf14-secondary-button">
              See how it works
            </a>
          </div>

          <div className="rf14-intent-block">
            <div className="rf14-intent-heading">
              <strong>What do you want to improve?</strong>
              <span>Select all that apply</span>
            </div>

            <div className="rf14-service-pills">
              {SERVICE_OPTIONS.map((service) => {
                const active = services.includes(service);
                return (
                  <motion.button
                    key={service}
                    type="button"
                    className={`rf14-service-pill ${active ? "is-active" : ""}`}
                    onClick={() => toggle(service)}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <AnimatePresence initial={false}>
                      {active ? (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.45, width: 0 }}
                          animate={{ opacity: 1, scale: 1, width: "auto" }}
                          exit={{ opacity: 0, scale: 0.45, width: 0 }}
                          transition={{ type: "spring", stiffness: 320, damping: 22 }}
                        >
                          <Check size={14} strokeWidth={2.6} />
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                    {service}
                  </motion.button>
                );
              })}
            </div>

            <div className="rf14-intent-feedback">
              <AnimatePresence mode="wait" initial={false}>
                {services.length ? (
                  <motion.div
                    key="active"
                    className="rf14-ready-banner"
                    initial={{ opacity: 0, height: 0, y: 5 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -5 }}
                    transition={{ type: "spring", stiffness: 260, damping: 26 }}
                  >
                    <span>
                      Ready to explore: <b>{services.join(", ")}</b>
                    </span>
                    <Link to={target}>
                      Let&apos;s go
                      <ArrowRight size={14} />
                    </Link>
                  </motion.div>
                ) : (
                  <motion.span
                    key="empty"
                    className="rf14-empty-feedback"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    exit={{ opacity: 0 }}
                  >
                    Select a workflow above to personalize your starting point.
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="rf14-scroll-cue" aria-hidden="true">
        <span>Scroll to see the motion</span>
        <i />
      </div>
    </section>
  );
}

function AudienceStrip() {
  return (
    <section className="rf14-audience-strip" aria-label="ReachFly audiences">
      <div className="rf14-section-width rf14-audience-inner">
        <span>Built for teams selling to businesses</span>
        <div>
          {AUDIENCES.map((item) => (
            <b key={item}>{item}</b>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section id="how" className="rf14-section rf14-workflow-section">
      <div className="rf14-section-width">
        <Reveal className="rf14-section-head">
          <span className="rf14-eyebrow">One connected sales motion</span>
          <h2>From market signal to booked meeting without rebuilding context.</h2>
          <p>
            ReachFly connects the four stages that matter most instead of forcing
            your team to keep translating the same prospect between separate tools.
          </p>
        </Reveal>

        <div className="rf14-workflow-grid">
          {WORKFLOW.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} delay={index * 0.06}>
                <article className="rf14-workflow-card">
                  <header>
                    <span>
                      <Icon size={20} />
                    </span>
                    <small>{item.number}</small>
                  </header>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function VoiceSection() {
  const bars = [32, 54, 38, 72, 48, 84, 44, 66, 35, 76, 52, 88, 41, 63, 47, 70];

  return (
    <section id="voice" className="rf14-voice-section" data-nav-tone="light">
      <div className="rf14-section-width rf14-voice-grid">
        <Reveal className="rf14-voice-copy">
          <span className="rf14-dark-eyebrow">AI Voice with context</span>
          <h2>Not a dialer. A sales conversation that already knows the lead.</h2>
          <p>
            Give your Voice Agent the prospect, business context, campaign objective,
            and conversation instructions before the call begins. Keep the outcome
            connected when the call ends.
          </p>

          <div className="rf14-voice-points">
            {["Lead + company context", "Call outcome + notes", "Callback + meeting intent"].map(
              (item) => (
                <span key={item}>
                  <Check size={15} />
                  {item}
                </span>
              )
            )}
          </div>

          <Link to="/signup" className="rf14-light-button">
            Start with AI Voice
            <ArrowRight size={16} />
          </Link>
        </Reveal>

        <Reveal className="rf14-voice-visual" delay={0.08}>
          <motion.div
            className="rf14-call-window"
            whileHover={{ rotateX: -1.2, rotateY: 1.4, y: -4 }}
            transition={{ type: "spring", stiffness: 170, damping: 20 }}
          >
            <header>
              <div>
                <i />
                <i />
                <i />
              </div>
              <span>Live AI conversation</span>
              <em>Connected</em>
            </header>

            <div className="rf14-call-contact">
              <span className="rf14-contact-avatar">NP</span>
              <div>
                <strong>Northstar Plumbing</strong>
                <small>Website context ready · Local services campaign</small>
              </div>
              <span className="rf14-live-pill">Live</span>
            </div>

            <div className="rf14-waveform" aria-hidden="true">
              {bars.map((height, index) => (
                <motion.i
                  key={`${height}-${index}`}
                  initial={{ height: 8 }}
                  animate={{ height }}
                  transition={{
                    duration: 0.72,
                    delay: index * 0.035,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>

            <div className="rf14-call-context">
              <article>
                <small>Opportunity</small>
                <strong>Booking flow needs attention</strong>
              </article>
              <article>
                <small>Intent</small>
                <strong>Qualify → book meeting</strong>
              </article>
            </div>

            <footer>
              <span>
                <MessageCircleMore size={15} />
                Outcome will return to the lead timeline
              </span>
              <button type="button">View context</button>
            </footer>
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}

function UseCasesSection() {
  return (
    <section id="use-cases" className="rf14-section rf14-usecase-section">
      <div className="rf14-section-width">
        <Reveal className="rf14-section-head rf14-section-head-compact">
          <span className="rf14-eyebrow">Built around real use cases</span>
          <h2>One platform. Three common ways teams create pipeline.</h2>
        </Reveal>

        <div className="rf14-usecase-grid">
          {USE_CASES.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.label} delay={index * 0.07}>
                <article className="rf14-usecase-card">
                  <span className="rf14-usecase-icon">
                    <Icon size={20} />
                  </span>
                  <small>{item.label}</small>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <Link to={item.href}>
                    Explore use case
                    <ArrowRight size={15} />
                  </Link>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  return (
    <section id="trust" className="rf14-trust-section">
      <div className="rf14-section-width">
        <Reveal className="rf14-trust-heading">
          <span className="rf14-eyebrow">Trust through visibility</span>
          <h2>Automation should move faster without making the workflow harder to understand.</h2>
        </Reveal>

        <div className="rf14-trust-grid">
          {TRUST_POINTS.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} delay={index * 0.06}>
                <article>
                  <span>
                    <Icon size={20} />
                  </span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="rf14-final-wrap" data-nav-tone="light">
      <div className="rf14-section-width">
        <Reveal className="rf14-final-card">
          <span>
            <Sparkles size={14} />
            From market to meeting
          </span>
          <h2>Your next customer is already in the market.</h2>
          <p>
            ReachFly helps you find them, understand the opportunity, start the
            conversation, and keep the next action moving.
          </p>
          <div>
            <Link to="/signup" className="rf14-final-primary">
              Create your ReachFly workspace
              <ArrowRight size={17} />
            </Link>
            <Link to="/login" className="rf14-final-secondary">
              Open workspace
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="rf14-footer" data-nav-tone="light">
      <div className="rf14-section-width rf14-footer-inner">
        <Link to="/" className="rf14-footer-brand">
          <BrandLogo size={34} />
          <span>
            <strong>ReachFly</strong>
            <small>AI sales workspace</small>
          </span>
        </Link>

        <p>
          Lead discovery, context, AI Voice, follow-up, meetings, and pipeline in one
          connected sales motion.
        </p>

        <nav>
          <Link to="/blog">Guides</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/login">Sign in</Link>
        </nav>
      </div>
    </footer>
  );
}

export default function Marketing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const characterLayerRef = useRef(null);

  useLenis();
  useCharacterScrollMotion(characterLayerRef);

  useSEO({
    title: "ReachFly.AI — AI Sales Workspace from Prospect to Conversation",
    description:
      "Discover focused business prospects, add useful context, run AI Voice conversations, coordinate follow-up, and keep meetings and pipeline connected with ReachFly.",
    path: "/",
  });

  return (
    <main className="rf14-page">
      <CharacterMotionStyles />
      <BackgroundVideo layerRef={characterLayerRef} />
      <Navbar open={menuOpen} setOpen={setMenuOpen} />
      <Hero />
      <AudienceStrip />
      <WorkflowSection />
      <VoiceSection />
      <UseCasesSection />
      <TrustSection />
      <FinalCTA />
      <Footer />
    </main>
  );
}
