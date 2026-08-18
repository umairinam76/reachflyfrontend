import {
  useEffect,
  useRef,
  useState,
} from "react";

const SCRIPT_ID =
  "reachfly-google-identity-services";

const SCRIPT_SRC =
  "https://accounts.google.com/gsi/client";

let googleIdentityPromise =
  null;

function loadGoogleIdentityScript() {
  if (
    typeof window ===
    "undefined"
  ) {
    return Promise.reject(
      new Error(
        "Google sign-in requires a browser."
      )
    );
  }

  if (
    window.google?.accounts
      ?.id
  ) {
    return Promise.resolve(
      window.google
    );
  }

  if (
    googleIdentityPromise
  ) {
    return googleIdentityPromise;
  }

  googleIdentityPromise =
    new Promise(
      (
        resolve,
        reject
      ) => {
        const settleLoaded =
          () => {
            if (
              window.google
                ?.accounts?.id
            ) {
              resolve(
                window.google
              );
              return;
            }

            googleIdentityPromise =
              null;

            reject(
              new Error(
                "Google sign-in could not be initialized."
              )
            );
          };

        const settleError =
          () => {
            googleIdentityPromise =
              null;

            reject(
              new Error(
                "Google sign-in could not be loaded."
              )
            );
          };

        const existing =
          document.getElementById(
            SCRIPT_ID
          );

        if (existing) {
          if (
            window.google
              ?.accounts?.id
          ) {
            settleLoaded();
            return;
          }

          existing.addEventListener(
            "load",
            settleLoaded,
            {
              once:
                true,
            }
          );

          existing.addEventListener(
            "error",
            settleError,
            {
              once:
                true,
            }
          );

          return;
        }

        const script =
          document.createElement(
            "script"
          );

        script.id =
          SCRIPT_ID;

        script.src =
          SCRIPT_SRC;

        script.async =
          true;

        script.defer =
          true;

        script.onload =
          settleLoaded;

        script.onerror =
          settleError;

        document.head.appendChild(
          script
        );
      }
    );

  return googleIdentityPromise;
}

export default function GoogleAuthButton({
  mode = "signin",
  onCredential,
  onError,
  disabled = false,
}) {
  const buttonRef =
    useRef(null);

  const callbackRef =
    useRef(
      onCredential
    );

  const errorRef =
    useRef(
      onError
    );

  const [
    ready,
    setReady,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const clientId =
    String(
      import.meta.env
        .VITE_GOOGLE_AUTH_CLIENT_ID ||
        ""
    ).trim();

  callbackRef.current =
    onCredential;

  errorRef.current =
    onError;

  useEffect(
    () => {
      let active =
        true;

      let observer =
        null;

      let renderTimer =
        null;

      if (!clientId) {
        setReady(
          false
        );
        setLoading(
          false
        );
        return undefined;
      }

      setLoading(
        true
      );

      function renderGoogleButton() {
        if (
          !active ||
          !buttonRef.current ||
          !window.google
            ?.accounts?.id
        ) {
          return;
        }

        const width =
          Math.max(
            260,
            Math.min(
              440,
              Math.floor(
                buttonRef.current
                  .clientWidth ||
                  420
              )
            )
          );

        buttonRef.current.innerHTML =
          "";

        window.google.accounts.id.renderButton(
          buttonRef.current,
          {
            type:
              "standard",
            theme:
              "outline",
            size:
              "large",
            text:
              mode ===
              "signup"
                ? "signup_with"
                : "signin_with",
            shape:
              "rectangular",
            logo_alignment:
              "left",
            width,
          }
        );

        setReady(
          true
        );
        setLoading(
          false
        );
      }

      loadGoogleIdentityScript()
        .then(
          () => {
            if (
              !active ||
              !buttonRef.current ||
              !window.google
                ?.accounts?.id
            ) {
              return;
            }

            window.google.accounts.id.initialize(
              {
                client_id:
                  clientId,
                callback:
                  (
                    response
                  ) => {
                    if (
                      !response
                        ?.credential
                    ) {
                      errorRef.current?.(
                        new Error(
                          "Google did not return a sign-in credential."
                        )
                      );
                      return;
                    }

                    callbackRef.current?.(
                      response.credential
                    );
                  },
                auto_select:
                  false,
                cancel_on_tap_outside:
                  true,
              }
            );

            renderGoogleButton();

            if (
              typeof ResizeObserver !==
              "undefined"
            ) {
              let previousWidth =
                Math.floor(
                  buttonRef.current
                    ?.clientWidth ||
                    0
                );

              observer =
                new ResizeObserver(
                  (
                    entries
                  ) => {
                    const nextWidth =
                      Math.floor(
                        entries?.[0]
                          ?.contentRect
                          ?.width ||
                          0
                      );

                    if (
                      !nextWidth ||
                      Math.abs(
                        nextWidth -
                          previousWidth
                      ) <
                        16
                    ) {
                      return;
                    }

                    previousWidth =
                      nextWidth;

                    window.clearTimeout(
                      renderTimer
                    );

                    renderTimer =
                      window.setTimeout(
                        renderGoogleButton,
                        80
                      );
                  }
                );

              observer.observe(
                buttonRef.current
              );
            }
          }
        )
        .catch(
          (
            error
          ) => {
            if (!active) {
              return;
            }

            setReady(
              false
            );
            setLoading(
              false
            );

            errorRef.current?.(
              error
            );
          }
        );

      return () => {
        active =
          false;

        observer?.disconnect?.();

        if (
          renderTimer
        ) {
          window.clearTimeout(
            renderTimer
          );
        }
      };
    },
    [
      clientId,
      mode,
    ]
  );

  if (!clientId) {
    return (
      <div
        className="rf-google-auth-unavailable"
        role="status"
      >
        <GoogleAuthButtonStyles />

        <span>
          Google sign-in will appear when the Google client is configured.
        </span>
      </div>
    );
  }

  return (
    <div
      className={[
        "rf-google-auth-wrap",
        disabled
          ? "disabled"
          : "",
        loading
          ? "loading"
          : "",
        ready
          ? "ready"
          : "",
      ]
        .filter(
          Boolean
        )
        .join(
          " "
        )}
      aria-busy={
        loading ||
        !ready
      }
      aria-disabled={
        disabled
      }
    >
      <GoogleAuthButtonStyles />

      {!ready ? (
        <div
          className="rf-google-auth-loading"
          aria-hidden="true"
        >
          <i />

          <span>
            Loading Google sign-in…
          </span>
        </div>
      ) : null}

      <div
        ref={
          buttonRef
        }
        className="rf-google-auth-button"
      />

      {disabled ? (
        <span
          className="rf-google-auth-blocker"
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

function GoogleAuthButtonStyles() {
  return (
    <style>{`
      .rf-google-auth-wrap,
      .rf-google-auth-unavailable{
        --rfga-text:#191c1d;
        --rfga-text2:#4d4c59;
        --rfga-muted:#777784;
        --rfga-line:#e2e4e7;
        --rfga-primary:#4648d4;
        --rfga-primary-soft:#e8e9ff;
        width:100%;
        box-sizing:border-box;
        font-family:
          Inter,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      .rf-google-auth-wrap *,
      .rf-google-auth-wrap *::before,
      .rf-google-auth-wrap *::after,
      .rf-google-auth-unavailable *,
      .rf-google-auth-unavailable *::before,
      .rf-google-auth-unavailable *::after{
        box-sizing:border-box;
      }

      @keyframes rfgaShimmer{
        from{
          background-position:200% 0;
        }
        to{
          background-position:-200% 0;
        }
      }

      .rf-google-auth-wrap{
        position:relative;
        min-height:44px;
        display:grid;
        place-items:center;
        overflow:hidden;
        border-radius:8px;
      }

      .rf-google-auth-button{
        width:100%;
        min-height:44px;
        display:grid;
        place-items:center;
      }

      .rf-google-auth-button > div,
      .rf-google-auth-button iframe{
        max-width:100%!important;
      }

      .rf-google-auth-loading{
        position:absolute;
        z-index:1;
        inset:0;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        padding:0 12px;
        color:var(--rfga-muted);
        background:
          linear-gradient(
            90deg,
            #f3f4f5 25%,
            #fbfbfc 45%,
            #f3f4f5 65%
          );
        background-size:220% 100%;
        border:1px solid var(--rfga-line);
        border-radius:8px;
        font-size:6.5px;
        animation:
          rfgaShimmer 1.25s
          linear infinite;
      }

      .rf-google-auth-loading i{
        width:8px;
        height:8px;
        background:var(--rfga-primary);
        border-radius:50%;
      }

      .rf-google-auth-wrap.ready .rf-google-auth-loading{
        display:none;
      }

      .rf-google-auth-wrap.disabled{
        opacity:.55;
      }

      .rf-google-auth-blocker{
        position:absolute;
        z-index:5;
        inset:0;
        cursor:not-allowed;
        background:transparent;
      }

      .rf-google-auth-unavailable{
        min-height:44px;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:8px 11px;
        color:#676872;
        background:#f7f8f9;
        border:1px dashed #d9dbdf;
        border-radius:8px;
        text-align:center;
      }

      .rf-google-auth-unavailable span{
        font-size:6.3px;
        line-height:10px;
      }

      @media(prefers-reduced-motion:reduce){
        .rf-google-auth-loading{
          animation:none!important;
        }
      }
    `}</style>
  );
}
