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

function ScrubbedBackgroundVideo() {
  const videoRef = useRef(null);
  const previousXRef = useRef(null);
  const targetTimeRef = useRef(0);
  const seekingRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const syncTargetToVideo = () => {
      if (Number.isFinite(video.currentTime)) {
        targetTimeRef.current = video.currentTime;
      }
    };

    const seekToTarget = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const next = clamp(targetTimeRef.current, 0, video.duration);
      if (Math.abs(video.currentTime - next) < 0.015) {
        seekingRef.current = false;
        return;
      }

      seekingRef.current = true;
      video.currentTime = next;
    };

    const handleSeeked = () => {
      seekingRef.current = false;
      if (Math.abs(video.currentTime - targetTimeRef.current) > 0.02) {
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
        targetTimeRef.current = video.currentTime || 0;
        return;
      }

      const delta = event.clientX - previousXRef.current;
      previousXRef.current = event.clientX;

      const timeDelta = (delta / window.innerWidth) * 0.8 * video.duration;
      targetTimeRef.current = clamp(targetTimeRef.current + timeDelta, 0, video.duration);

      if (!seekingRef.current) {
        seekToTarget();
      }
    };

    const resetPreviousX = () => {
      previousXRef.current = null;
    };

    video.addEventListener("loadedmetadata", syncTargetToVideo);
    video.addEventListener("seeked", handleSeeked);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("blur", resetPreviousX);

    return () => {
      video.removeEventListener("loadedmetadata", syncTargetToVideo);
      video.removeEventListener("seeked", handleSeeked);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("blur", resetPreviousX);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const configurePlayback = () => {
      if (window.innerWidth < 1024) {
        video.autoplay = true;
        video.loop = true;
        video.play().catch(() => {
          // Mobile browsers may defer playback until enough media is buffered.
        });
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
    <div className="order-last lg:order-none relative lg:absolute lg:inset-0 lg:z-0 overflow-hidden pointer-events-none w-full aspect-square md:aspect-video lg:aspect-auto lg:h-full bg-neutral-50 lg:bg-transparent">
      <video
        ref={videoRef}
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-cover object-right lg:object-right-bottom"
        aria-hidden="true"
      >
        <source src={VIDEO_URL} type="video/mp4" />
      </video>

      <div className="absolute inset-0 hidden lg:block bg-gradient-to-r from-white via-white/80 to-white/5" />
      <div className="absolute inset-0 hidden lg:block bg-[radial-gradient(circle_at_28%_48%,rgba(255,255,255,.88),rgba(255,255,255,.22)_44%,transparent_70%)]" />
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

  return (
    <>
      <header className={`fixed top-0 inset-x-0 z-10 px-5 sm:px-8 py-4 sm:py-5 flex flex-row justify-between items-center bg-transparent rf13-nav ${isPastHero ? "rf13-nav-past" : ""}`}>
        <Link to="/" className="flex flex-row items-center gap-3" aria-label="ReachFly home">
          <BrandLogo size={34} />
          <span className="text-[21px] sm:text-[26px] tracking-tight text-black font-medium select-none">
            ReachFly<sup className="text-[9px] sm:text-[10px] ml-0.5">AI</sup>
          </span>
          <span className="text-[25px] sm:text-[30px] text-black select-none tracking-[-0.02em] font-medium leading-none mb-1" aria-hidden="true">
            &#10033;
          </span>
        </Link>

        <nav className="hidden md:flex flex-row items-center text-[23px] text-black absolute left-1/2 -translate-x-1/2" aria-label="Landing page navigation">
          {navItems.map(([href, label], index) => (
            <span key={href} className="flex items-center">
              <a href={href} className="hover:opacity-60 transition-opacity">
                {label}
              </a>
              {index < navItems.length - 1 ? (
                <span className="opacity-40">,&nbsp;</span>
              ) : null}
            </span>
          ))}
        </nav>

        <Link
          to="/signup"
          className="hidden md:inline text-[23px] text-black underline underline-offset-2 hover:opacity-60 transition-opacity"
        >
          Get started
        </Link>

        <button
          type="button"
          aria-label={isMobileMenuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((current) => !current)}
          className="md:hidden relative z-20 flex h-8 w-8 flex-col items-center justify-center gap-[5px]"
        >
          <span
            className={`w-6 h-[2px] bg-black transition-all duration-300 ${
              isMobileMenuOpen ? "rotate-45 translate-y-[7px]" : ""
            }`}
          />
          <span
            className={`w-6 h-[2px] bg-black transition-all duration-300 ${
              isMobileMenuOpen ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`w-6 h-[2px] bg-black transition-all duration-300 ${
              isMobileMenuOpen ? "-rotate-45 -translate-y-[7px]" : ""
            }`}
          />
        </button>
      </header>

      <div
        className={`md:hidden fixed inset-0 z-[9] bg-white/95 backdrop-blur-sm transition-opacity duration-300 ${
          isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <nav className="h-full px-6 pt-28 pb-10 flex flex-col justify-between" aria-label="Mobile landing page navigation">
          <div className="flex flex-col gap-5 text-4xl tracking-tight text-black">
            {navItems.map(([href, label], index) => (
              <motion.a
                key={href}
                href={href}
                onClick={() => setIsMobileMenuOpen(false)}
                initial={false}
                animate={isMobileMenuOpen ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
                transition={{ delay: isMobileMenuOpen ? index * 0.04 : 0 }}
              >
                {label}
              </motion.a>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <Link
              to="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-lg text-black underline underline-offset-4"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              onClick={() => setIsMobileMenuOpen(false)}
              className="inline-flex items-center justify-between rounded-full bg-[#1C2E1E] px-5 py-4 text-white text-lg"
            >
              Create workspace
              <ArrowRight size={19} />
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
    "turn the right businesses\ninto real conversations.",
    38,
    600
  );

  useEffect(() => {
    const updateHeader = () => {
      setIsPastHero(window.scrollY > Math.max(520, window.innerHeight * 0.82));
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
    <section className="rf13-hero-shell relative bg-white text-neutral-900 font-sans selection:bg-[#EAECE9] selection:text-[#1C2E1E] antialiased overflow-x-hidden flex flex-col lg:block lg:min-h-screen">
      <HeroNavbar
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isPastHero={isPastHero}
      />

      <ScrubbedBackgroundVideo />

      <div className="relative z-10 flex flex-col order-first lg:order-none w-full bg-white lg:bg-transparent pb-8 lg:pb-0 lg:min-h-screen">
        <main
          id="spade-hero"
          className="w-full max-w-7xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center pt-28 sm:pt-32 lg:pt-28"
        >
          <div className="w-full max-w-3xl lg:max-w-[720px]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/70 px-3 py-1.5 text-xs font-medium tracking-[0.08em] uppercase text-[#4D5B4E] backdrop-blur-md mb-6">
                ReachFly · Prospect to conversation
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-[76px] font-normal tracking-tight text-black leading-[1.08] mb-8 select-none w-full whitespace-pre-wrap">
                {displayed}
                {!done ? (
                  <span className="inline-block w-[2px] h-[1.1em] bg-black align-middle ml-[2px] animate-blink" />
                ) : null}
              </h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <p className="text-lg md:text-xl text-[#5A635A] leading-relaxed font-normal mb-14 max-w-2xl">
                ReachFly finds focused prospects, adds business context, and helps your team start better conversations. <br />
                Select where you want to begin and we&apos;ll take you straight into the right workflow.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18 }}
              className="max-w-3xl"
            >
              <h2 className="text-2xl font-medium tracking-tight mb-2">What do you want to improve?</h2>
              <p className="opacity-85 text-[#738273] mb-8">Select all that apply</p>

              <div className="flex flex-wrap gap-3 sm:gap-4">
                {SERVICE_OPTIONS.map((service) => {
                  const active = services.includes(service);

                  return (
                    <motion.button
                      key={service}
                      type="button"
                      onClick={() => toggleService(service)}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      className={`min-h-12 rounded-full px-5 sm:px-6 py-3 inline-flex items-center gap-2.5 text-sm sm:text-base font-medium transition-colors ${
                        active
                          ? "bg-[#1C2E1E] text-white shadow-md shadow-emerald-950/5 transform"
                          : "bg-white text-[#1C2E1E] border border-[#F1F3F1] hover:bg-[#F1F3F1]/55"
                      }`}
                    >
                      <AnimatePresence initial={false}>
                        {active ? (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.4, width: 0 }}
                            animate={{ opacity: 1, scale: 1, width: "auto" }}
                            exit={{ opacity: 0, scale: 0.4, width: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className="inline-flex"
                          >
                            <Check size={17} strokeWidth={2.4} />
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                      {service}
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-5 min-h-[74px]">
                <AnimatePresence mode="wait" initial={false}>
                  {services.length === 0 ? (
                    <motion.p
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.5 }}
                      exit={{ opacity: 0 }}
                      className="italic text-xs text-[#1C2E1E] py-4"
                    >
                      Please click to select services above.
                    </motion.p>
                  ) : (
                    <motion.div
                      key="active"
                      initial={{ opacity: 0, height: 0, y: 5 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -5 }}
                      transition={{ type: "spring", stiffness: 260, damping: 26 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-[#FAFBF9] border border-[#EEF1ED] rounded-2xl px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between shadow-sm">
                        <p className="text-sm text-[#324334]">
                          Ready to inquire about: <strong>{services.join(", ")}</strong>
                        </p>
                        <Link
                          to={inquiryTarget}
                          className="inline-flex shrink-0 items-center gap-1.5 text-[#4D6D47] uppercase text-xs font-semibold tracking-[0.08em] hover:opacity-60 transition-opacity"
                        >
                          Let&apos;s Go
                          <ArrowRight size={14} />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </section>
  );
}
