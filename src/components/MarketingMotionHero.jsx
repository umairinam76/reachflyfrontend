import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import BrandLogo from "./BrandLogo";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4";

const SERVICE_OPTIONS = ["Lead discovery", "AI Voice", "Campaign", "Other"];

export function useTypewriter(text, speed = 38, startDelay = 600) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);

    let intervalId;

    const delayId = window.setTimeout(() => {
      let index = 0;

      intervalId = window.setInterval(() => {
        index += 1;
        setDisplayed(text.slice(0, index));

        if (index >= text.length) {
          window.clearInterval(intervalId);
          setDone(true);
        }
      }, speed);
    }, startDelay);

    return () => {
      window.clearTimeout(delayId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}

function BackgroundVideo() {
  const videoRef = useRef(null);
  const previousXRef = useRef(null);
  const targetTimeRef = useRef(0);
  const seekingRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const syncTarget = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;

      if (window.innerWidth >= 1024 && video.currentTime === 0) {
        targetTimeRef.current = Math.min(video.duration * 0.16, video.duration);
        try {
          video.currentTime = targetTimeRef.current;
        } catch {
          targetTimeRef.current = 0;
        }
      } else {
        targetTimeRef.current = Number.isFinite(video.currentTime)
          ? video.currentTime
          : 0;
      }
    };

    const seekToTarget = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;

      const nextTime = clamp(targetTimeRef.current, 0, video.duration);

      if (Math.abs(video.currentTime - nextTime) < 0.012) {
        seekingRef.current = false;
        return;
      }

      seekingRef.current = true;

      try {
        video.currentTime = nextTime;
      } catch {
        seekingRef.current = false;
      }
    };

    const handleSeeked = () => {
      seekingRef.current = false;

      if (
        window.innerWidth >= 1024 &&
        Math.abs(video.currentTime - targetTimeRef.current) > 0.018
      ) {
        seekToTarget();
      }
    };

    const handleMouseMove = (event) => {
      if (window.innerWidth < 1024) {
        previousXRef.current = null;
        return;
      }

      if (!Number.isFinite(video.duration) || video.duration <= 0) return;

      if (previousXRef.current === null) {
        previousXRef.current = event.clientX;
        targetTimeRef.current = video.currentTime || targetTimeRef.current || 0;
        return;
      }

      const delta = event.clientX - previousXRef.current;
      previousXRef.current = event.clientX;

      const timeDelta =
        (delta / Math.max(window.innerWidth, 1)) * 0.8 * video.duration;

      targetTimeRef.current = clamp(
        targetTimeRef.current + timeDelta,
        0,
        video.duration
      );

      if (!seekingRef.current) seekToTarget();
    };

    const resetPointer = () => {
      previousXRef.current = null;
    };

    video.addEventListener("loadedmetadata", syncTarget);
    video.addEventListener("seeked", handleSeeked);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseleave", resetPointer, { passive: true });
    window.addEventListener("blur", resetPointer);

    return () => {
      video.removeEventListener("loadedmetadata", syncTarget);
      video.removeEventListener("seeked", handleSeeked);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", resetPointer);
      window.removeEventListener("blur", resetPointer);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const configurePlayback = () => {
      if (window.innerWidth < 1024) {
        previousXRef.current = null;
        video.autoplay = true;
        video.loop = true;
        video.play().catch(() => {});
      } else {
        video.autoplay = false;
        video.loop = false;
        video.pause();
      }
    };

    configurePlayback();

    video.addEventListener("canplay", configurePlayback);
    window.addEventListener("resize", configurePlayback, { passive: true });

    return () => {
      video.removeEventListener("canplay", configurePlayback);
      window.removeEventListener("resize", configurePlayback);
    };
  }, []);

  return (
    <div className="rf13-video-bg absolute inset-0 z-0 overflow-hidden pointer-events-none bg-white">
      <video
        ref={videoRef}
        muted
        playsInline
        preload="auto"
        className="rf13-video absolute inset-0 h-full w-full object-cover"
        aria-hidden="true"
      >
        <source src={VIDEO_URL} type="video/mp4" />
      </video>

      <div className="rf13-video-wash absolute inset-0" aria-hidden="true" />
      <div className="rf13-video-bottom absolute inset-0" aria-hidden="true" />
    </div>
  );
}

function HeroNavbar({ isMobileMenuOpen, setIsMobileMenuOpen, isPastHero }) {
  const navItems = [
    ["#why", "Platform"],
    ["#voice", "AI Voice"],
    ["#use-cases", "Use cases"],
    ["#pricing", "Pricing"],
  ];

  const navTone = isPastHero ? "rf13-nav-light" : "rf13-nav-dark";

  return (
    <>
      <header
        className={`rf13-nav ${navTone} fixed top-0 inset-x-0 z-50 px-5 sm:px-8 lg:px-10 py-4 sm:py-5 flex items-center justify-between bg-transparent`}
      >
        <Link
          to="/"
          className="rf13-brand flex items-center gap-2.5 sm:gap-3"
          aria-label="ReachFly home"
        >
          <BrandLogo size={34} />
          <span className="text-[20px] sm:text-[24px] tracking-[-0.035em] font-semibold select-none">
            ReachFly
            <sup className="text-[8px] sm:text-[9px] ml-1 tracking-normal font-semibold">
              AI
            </sup>
          </span>
        </Link>

        <nav
          className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2 text-[15px] lg:text-[16px] font-medium"
          aria-label="Landing page navigation"
        >
          {navItems.map(([href, label], index) => (
            <span key={href} className="flex items-center">
              <a href={href} className="px-2 hover:opacity-55 transition-opacity">
                {label}
              </a>
              {index < navItems.length - 1 ? (
                <span className="opacity-30">·</span>
              ) : null}
            </span>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <Link
            to="/login"
            className="text-[15px] lg:text-[16px] font-medium hover:opacity-55 transition-opacity"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="rf13-nav-cta inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] lg:text-[15px] font-semibold transition-all"
          >
            Get started
            <ArrowRight size={15} />
          </Link>
        </div>

        <button
          type="button"
          aria-label={isMobileMenuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((current) => !current)}
          className="md:hidden relative z-[70] flex h-9 w-9 flex-col items-center justify-center gap-[5px]"
        >
          <span
            className={`rf13-burger-line w-6 h-[2px] transition-all duration-300 ${
              isMobileMenuOpen ? "rotate-45 translate-y-[7px]" : ""
            }`}
          />
          <span
            className={`rf13-burger-line w-6 h-[2px] transition-all duration-300 ${
              isMobileMenuOpen ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`rf13-burger-line w-6 h-[2px] transition-all duration-300 ${
              isMobileMenuOpen ? "-rotate-45 -translate-y-[7px]" : ""
            }`}
          />
        </button>
      </header>

      <div
        className={`md:hidden fixed inset-0 z-40 bg-white/95 backdrop-blur-xl transition-opacity duration-300 ${
          isMobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <nav
          className="h-full px-6 pt-28 pb-10 flex flex-col justify-between"
          aria-label="Mobile landing page navigation"
        >
          <div className="flex flex-col gap-5 text-[38px] leading-[1.06] tracking-[-0.04em] text-black">
            {navItems.map(([href, label], index) => (
              <motion.a
                key={href}
                href={href}
                onClick={() => setIsMobileMenuOpen(false)}
                initial={false}
                animate={
                  isMobileMenuOpen
                    ? { opacity: 1, x: 0 }
                    : { opacity: 0, x: -18 }
                }
                transition={{ delay: isMobileMenuOpen ? index * 0.045 : 0 }}
              >
                {label}
              </motion.a>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Link
              to="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-base text-black underline underline-offset-4"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              onClick={() => setIsMobileMenuOpen(false)}
              className="inline-flex items-center justify-between rounded-full bg-[#1C2E1E] px-5 py-4 text-white text-base font-semibold"
            >
              Create workspace
              <ArrowRight size={18} />
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}

export default function MarketingMotionHero() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPastHero, setIsPastHero] = useState(false);
  const [services, setServices] = useState([]);

  const { displayed, done } = useTypewriter(
    "Our AI Agents, turn the right businesses\ninto real conversations for you.",
    38,
    500
  );

  useEffect(() => {
    const updateHeader = () => {
      setIsPastHero(window.scrollY > Math.max(520, window.innerHeight * 0.86));
    };

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    window.addEventListener("resize", updateHeader, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateHeader);
      window.removeEventListener("resize", updateHeader);
    };
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key === "Escape") setIsMobileMenuOpen(false);
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMobileMenuOpen]);

  const toggleService = (service) => {
    setServices((current) =>
      current.includes(service)
        ? current.filter((item) => item !== service)
        : [...current, service]
    );
  };

  const inquiryTarget = services.length
    ? `/signup?interests=${encodeURIComponent(services.join(","))}`
    : "/signup";

  return (
    <section className="rf13-hero-shell relative isolate min-h-[100svh] overflow-hidden bg-white text-neutral-900 font-sans selection:bg-[#EAECE9] selection:text-[#1C2E1E] antialiased">
      <BackgroundVideo />

      <HeroNavbar
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isPastHero={isPastHero}
      />

      <div className="relative z-10 min-h-[100svh] w-full">
        <main
          id="spade-hero"
          className="rf13-content mx-auto flex min-h-[100svh] w-full max-w-[1440px] items-center px-5 sm:px-8 lg:px-10 xl:px-14 pt-28 pb-14 sm:pt-32 sm:pb-16"
        >
          <div className="rf13-copy w-full max-w-[660px] xl:max-w-[700px]">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/58 px-3.5 py-2 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.09em] text-[#39463A] backdrop-blur-xl shadow-[0_10px_35px_rgba(36,49,37,.06)]">
                ReachFly · From prospect to conversation
              </div>

              <h1 className="mb-7 w-full whitespace-pre-wrap select-none text-[45px] sm:text-[58px] md:text-[67px] lg:text-[72px] xl:text-[78px] font-normal tracking-[-0.055em] text-black leading-[0.98]">
                {displayed}
                {!done ? (
                  <span className="inline-block w-[2px] h-[1em] bg-black align-[-0.08em] ml-[3px] animate-blink" />
                ) : null}
              </h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="mb-9 max-w-[610px] text-[16px] sm:text-[18px] leading-[1.65] font-normal text-[#4F5D50]">
                Discover focused businesses, understand why they may care, and move
                from first signal to AI Voice, follow-up, meetings, and pipeline in
                one connected sales workspace.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-[640px]"
            >
              <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.025em] text-[#172419]">
                    What do you want to improve?
                  </h2>
                  <p className="mt-1 text-[13px] sm:text-sm text-[#6A776B]">
                    Select all that apply
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 sm:gap-3">
                {SERVICE_OPTIONS.map((service) => {
                  const active = services.includes(service);

                  return (
                    <motion.button
                      key={service}
                      type="button"
                      onClick={() => toggleService(service)}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      className={`min-h-11 rounded-full px-4 sm:px-5 py-2.5 inline-flex items-center gap-2 text-[13px] sm:text-sm font-semibold backdrop-blur-xl transition-[background-color,color,border-color,box-shadow] ${
                        active
                          ? "bg-[#1C2E1E] text-white border border-[#1C2E1E] shadow-[0_12px_28px_rgba(28,46,30,.14)]"
                          : "bg-white/72 text-[#1C2E1E] border border-white/75 shadow-[0_10px_30px_rgba(33,48,35,.055)] hover:bg-white/90"
                      }`}
                    >
                      <AnimatePresence initial={false}>
                        {active ? (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.45, width: 0 }}
                            animate={{ opacity: 1, scale: 1, width: "auto" }}
                            exit={{ opacity: 0, scale: 0.45, width: 0 }}
                            transition={{ type: "spring", stiffness: 320, damping: 22 }}
                            className="inline-flex"
                          >
                            <Check size={15} strokeWidth={2.5} />
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                      {service}
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-4 min-h-[68px]">
                <AnimatePresence mode="wait" initial={false}>
                  {services.length === 0 ? (
                    <motion.p
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.48 }}
                      exit={{ opacity: 0 }}
                      className="py-3 text-xs italic text-[#2B3C2D]"
                    >
                      Select a workflow above to continue.
                    </motion.p>
                  ) : (
                    <motion.div
                      key="active"
                      initial={{ opacity: 0, height: 0, y: 6 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -5 }}
                      transition={{ type: "spring", stiffness: 260, damping: 26 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-3 rounded-2xl border border-white/75 bg-white/74 px-4 py-3.5 shadow-[0_14px_38px_rgba(36,49,37,.07)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <p className="text-[13px] sm:text-sm text-[#324334]">
                          Ready to explore: <strong>{services.join(", ")}</strong>
                        </p>
                        <Link
                          to={inquiryTarget}
                          className="inline-flex shrink-0 items-center gap-1.5 text-[#466642] uppercase text-xs font-bold tracking-[0.08em] hover:opacity-60 transition-opacity"
                        >
                          Let&apos;s Go
                          <ArrowRight size={14} />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 rounded-full bg-[#1C2E1E] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(28,46,30,.16)] transition-transform hover:-translate-y-0.5"
                >
                  Create workspace
                  <ArrowRight size={16} />
                </Link>
                <a
                  href="#why"
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/56 px-5 py-3 text-sm font-semibold text-[#1C2E1E] backdrop-blur-xl transition-colors hover:bg-white/82"
                >
                  See how it works
                </a>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </section>
  );
}
