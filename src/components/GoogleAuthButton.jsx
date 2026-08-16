import { useEffect, useRef, useState } from "react";

const SCRIPT_ID = "reachfly-google-identity-services";
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadGoogleIdentityScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in requires a browser."));
  }
  if (window.google?.accounts?.id) return Promise.resolve(window.google);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google sign-in could not be loaded.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Google sign-in could not be loaded."));
    document.head.appendChild(script);
  });
}

export default function GoogleAuthButton({
  mode = "signin",
  onCredential,
  onError,
  disabled = false,
}) {
  const buttonRef = useRef(null);
  const callbackRef = useRef(onCredential);
  const errorRef = useRef(onError);
  const [ready, setReady] = useState(false);
  const clientId = String(import.meta.env.VITE_GOOGLE_AUTH_CLIENT_ID || "").trim();

  callbackRef.current = onCredential;
  errorRef.current = onError;

  useEffect(() => {
    let active = true;
    if (!clientId) {
      setReady(false);
      return undefined;
    }

    loadGoogleIdentityScript()
      .then(() => {
        if (!active || !buttonRef.current || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (!response?.credential) {
              errorRef.current?.(new Error("Google did not return a sign-in credential."));
              return;
            }
            callbackRef.current?.(response.credential);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        buttonRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: mode === "signup" ? "signup_with" : "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.max(260, Math.min(440, buttonRef.current.clientWidth || 420)),
        });
        setReady(true);
      })
      .catch((error) => {
        if (!active) return;
        setReady(false);
        errorRef.current?.(error);
      });

    return () => {
      active = false;
    };
  }, [clientId, mode]);

  if (!clientId) {
    return (
      <div className="rf-google-auth-unavailable" role="status">
        Google sign-in will appear when the Google client is configured.
      </div>
    );
  }

  return (
    <div className={`rf-google-auth-wrap ${disabled ? "disabled" : ""}`} aria-busy={!ready}>
      <div ref={buttonRef} className="rf-google-auth-button" />
      {disabled ? <span className="rf-google-auth-blocker" aria-hidden="true" /> : null}
    </div>
  );
}
