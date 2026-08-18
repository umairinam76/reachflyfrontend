/**
 * ReachFly public runtime environment helpers.
 *
 * This module intentionally exposes only browser-safe configuration values.
 * Never place private provider credentials, webhook secrets, database service
 * keys, payment secrets, or SIP passwords in VITE_* variables because Vite
 * embeds those values in the client bundle.
 */

const DEFAULT_LOCAL_API_ORIGIN =
  "http://localhost:8787";

const DEFAULT_PRODUCTION_API_ORIGIN =
  "https://api.reachflyai.com";

export const IS_BROWSER =
  typeof window !==
  "undefined";

export const IS_DEVELOPMENT =
  Boolean(
    import.meta.env.DEV
  );

export const IS_PRODUCTION =
  Boolean(
    import.meta.env.PROD
  );

export const APP_MODE =
  String(
    import.meta.env.MODE ||
      "production"
  );

export function cleanUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

export function isLocalHostname(
  hostname
) {
  const value =
    String(hostname || "")
      .trim()
      .toLowerCase();

  return (
    value === "localhost" ||
    value === "127.0.0.1" ||
    value === "::1" ||
    value.endsWith(
      ".localhost"
    )
  );
}

export function getAppOrigin() {
  if (!IS_BROWSER) {
    return "";
  }

  return cleanUrl(
    window.location.origin
  );
}

export function resolveApiOrigin({
  configured =
    import.meta.env.VITE_API_URL,
} = {}) {
  const configuredValue =
    cleanUrl(configured);

  const browserIsLocal =
    IS_BROWSER &&
    isLocalHostname(
      window.location.hostname
    );

  const fallback =
    browserIsLocal
      ? DEFAULT_LOCAL_API_ORIGIN
      : DEFAULT_PRODUCTION_API_ORIGIN;

  const candidate =
    configuredValue ||
    fallback;

  try {
    const parsed =
      new URL(
        candidate,
        IS_BROWSER
          ? window.location.origin
          : DEFAULT_PRODUCTION_API_ORIGIN
      );

    if (
      IS_BROWSER &&
      window.location.protocol ===
        "https:" &&
      parsed.protocol ===
        "http:" &&
      !isLocalHostname(
        parsed.hostname
      )
    ) {
      return DEFAULT_PRODUCTION_API_ORIGIN;
    }

    if (
      parsed.protocol ===
        "ws:"
    ) {
      parsed.protocol =
        "http:";
    }

    if (
      parsed.protocol ===
        "wss:"
    ) {
      parsed.protocol =
        "https:";
    }

    return cleanUrl(
      parsed.origin +
        parsed.pathname
    ).replace(
      /\/api$/i,
      ""
    );
  } catch {
    return fallback;
  }
}

export function resolveApiBaseUrl(
  options = {}
) {
  const origin =
    resolveApiOrigin(
      options
    );

  return `${cleanUrl(
    origin
  )}/api`;
}

export function resolveSocketBaseUrl({
  configured =
    import.meta.env.VITE_SOCKET_URL,
  apiBaseUrl =
    resolveApiBaseUrl(),
} = {}) {
  const apiOrigin =
    cleanUrl(
      apiBaseUrl
    ).replace(
      /\/api$/i,
      ""
    );

  const candidate =
    cleanUrl(configured) ||
    apiOrigin;

  try {
    const parsed =
      new URL(
        candidate,
        IS_BROWSER
          ? window.location.origin
          : apiOrigin
      );

    if (
      parsed.protocol ===
        "ws:"
    ) {
      parsed.protocol =
        "http:";
    }

    if (
      parsed.protocol ===
        "wss:"
    ) {
      parsed.protocol =
        "https:";
    }

    if (
      IS_BROWSER &&
      window.location.protocol ===
        "https:" &&
      parsed.protocol ===
        "http:"
    ) {
      const secureApi =
        new URL(apiOrigin);

      if (
        secureApi.protocol ===
        "https:"
      ) {
        return secureApi.origin;
      }

      parsed.protocol =
        "https:";
    }

    return parsed.origin;
  } catch {
    return apiOrigin;
  }
}

export const API_ORIGIN =
  resolveApiOrigin();

export const API_BASE_URL =
  resolveApiBaseUrl({
    configured:
      API_ORIGIN,
  });

export const SOCKET_BASE_URL =
  resolveSocketBaseUrl({
    apiBaseUrl:
      API_BASE_URL,
  });

export function getPublicRuntimeConfig() {
  return Object.freeze({
    mode:
      APP_MODE,
    development:
      IS_DEVELOPMENT,
    production:
      IS_PRODUCTION,
    appOrigin:
      getAppOrigin(),
    apiOrigin:
      API_ORIGIN,
    apiBaseUrl:
      API_BASE_URL,
    socketBaseUrl:
      SOCKET_BASE_URL,
  });
}

export function assertPublicRuntimeConfig() {
  const issues = [];

  if (
    !/^https?:\/\//i.test(
      API_BASE_URL
    )
  ) {
    issues.push(
      "The API URL is not a valid HTTP(S) address."
    );
  }

  if (
    IS_BROWSER &&
    window.location.protocol ===
      "https:" &&
    API_BASE_URL.startsWith(
      "http://"
    ) &&
    !isLocalHostname(
      new URL(
        API_BASE_URL
      ).hostname
    )
  ) {
    issues.push(
      "The HTTPS application cannot use an insecure HTTP API."
    );
  }

  return {
    valid:
      issues.length === 0,
    issues,
  };
}

export default getPublicRuntimeConfig();
