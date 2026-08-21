import { useEffect } from "react";

export const REACHFLY_SITE_URL = normalizeSiteUrl(
  import.meta.env?.VITE_SITE_URL ||
    "https://www.reachflyai.com"
);

const DEFAULT_ROBOTS =
  "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

const JSON_LD_ID = "reachfly-route-json-ld";
const PRERENDER_JSON_LD_SELECTOR =
  'script[data-reachfly-prerender="true"][type="application/ld+json"]';

export function useSEO({
  title,
  description,
  path = "/",
  canonical,
  robots = DEFAULT_ROBOTS,
  jsonLd,
  image,
  imageAlt = "",
  type = "website",
  noindex = false,
}) {
  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const resolvedCanonical = canonicalUrl(
      canonical || path || "/"
    );

    const resolvedImage = image
      ? absoluteUrl(image)
      : "";

    const resolvedRobots = noindex
      ? "noindex,nofollow"
      : robots || DEFAULT_ROBOTS;

    if (title) {
      document.title = String(title);
    }

    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", resolvedRobots);
    upsertMeta("name", "author", "ReachFlyAI");

    upsertMeta("property", "og:site_name", "ReachFlyAI");
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", resolvedCanonical);
    upsertMeta("property", "og:type", type || "website");

    if (resolvedImage) {
      upsertMeta("property", "og:image", resolvedImage);
      upsertMeta(
        "property",
        "og:image:alt",
        imageAlt || title || "ReachFlyAI"
      );
    } else {
      removeMeta("property", "og:image");
      removeMeta("property", "og:image:alt");
    }

    upsertMeta(
      "name",
      "twitter:card",
      resolvedImage
        ? "summary_large_image"
        : "summary"
    );
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);

    if (resolvedImage) {
      upsertMeta("name", "twitter:image", resolvedImage);
      upsertMeta(
        "name",
        "twitter:image:alt",
        imageAlt || title || "ReachFlyAI"
      );
    } else {
      removeMeta("name", "twitter:image");
      removeMeta("name", "twitter:image:alt");
    }

    upsertCanonical(resolvedCanonical);

    /*
     * A directly loaded prerendered public page already contains JSON-LD.
     * Once React owns the route, remove the prerender copy before inserting
     * the client route copy so Google never sees two managed versions.
     */
    upsertJsonLd(jsonLd);

    return () => {
      /*
       * Keep title/meta/canonical in place between client-side transitions
       * to avoid a flash of empty metadata. Route JSON-LD is removed because
       * stale structured data must not survive navigation.
       */
      removeManagedJsonLd();
    };
  }, [
    canonical,
    description,
    image,
    imageAlt,
    jsonLd,
    noindex,
    path,
    robots,
    title,
    type,
  ]);
}

export function absoluteUrl(value = "/") {
  const text = String(value || "/").trim();

  if (!text) {
    return `${REACHFLY_SITE_URL}/`;
  }

  try {
    if (/^https?:\/\//i.test(text)) {
      return new URL(text).toString();
    }
  } catch {
    return `${REACHFLY_SITE_URL}/`;
  }

  const normalizedPath = text.startsWith("/")
    ? text
    : `/${text}`;

  return `${REACHFLY_SITE_URL}${normalizedPath}`;
}

export function canonicalUrl(value = "/") {
  const pathname = canonicalPath(value);

  if (pathname === "/") {
    return `${REACHFLY_SITE_URL}/`;
  }

  const cleanPath = pathname
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "");

  return `${REACHFLY_SITE_URL}${cleanPath || "/"}`;
}

export function canonicalPath(value = "/") {
  const text = String(value || "/").trim();

  if (!text) {
    return "/";
  }

  try {
    if (/^https?:\/\//i.test(text)) {
      const url = new URL(text);
      return url.pathname || "/";
    }
  } catch {
    return "/";
  }

  const withoutHash = text.split("#")[0];
  const withoutQuery = withoutHash.split("?")[0];

  if (!withoutQuery) {
    return "/";
  }

  return withoutQuery.startsWith("/")
    ? withoutQuery
    : `/${withoutQuery}`;
}

function normalizeSiteUrl(value) {
  const fallback = "https://www.reachflyai.com";

  const text = String(value || fallback)
    .trim()
    .replace(/\/+$/, "");

  if (!/^https?:\/\//i.test(text)) {
    return fallback;
  }

  try {
    const url = new URL(text);

    if (!url.hostname) {
      return fallback;
    }

    return `${url.protocol}//${url.host}`;
  } catch {
    return fallback;
  }
}

function upsertMeta(attr, key, content) {
  if (!content) {
    removeMeta(attr, key);
    return;
  }

  let tag = document.head.querySelector(
    `meta[${attr}="${escapeSelectorValue(key)}"]`
  );

  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }

  tag.setAttribute("content", String(content));
}

function removeMeta(attr, key) {
  document.head
    .querySelector(
      `meta[${attr}="${escapeSelectorValue(key)}"]`
    )
    ?.remove();
}

function upsertCanonical(href) {
  if (!href) {
    return;
  }

  let link = document.head.querySelector(
    'link[rel="canonical"]'
  );

  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }

  link.href = href;
}

function upsertJsonLd(data) {
  removeManagedJsonLd();

  if (!data) {
    return;
  }

  const items = Array.isArray(data)
    ? data
    : [data];

  const validItems = items.filter(Boolean);

  if (!validItems.length) {
    return;
  }

  const script = document.createElement("script");
  script.id = JSON_LD_ID;
  script.type = "application/ld+json";
  script.setAttribute("data-reachfly-route-json-ld", "true");

  script.textContent = safeJson(
    validItems.length === 1
      ? validItems[0]
      : validItems
  );

  document.head.appendChild(script);
}

function removeManagedJsonLd() {
  document.getElementById(JSON_LD_ID)?.remove();

  document.head
    .querySelectorAll(PRERENDER_JSON_LD_SELECTOR)
    .forEach((script) => script.remove());

  document.head
    .querySelectorAll(
      'script[data-reachfly-route-json-ld="true"][type="application/ld+json"]'
    )
    .forEach((script) => script.remove());
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function escapeSelectorValue(value) {
  const text = String(value || "");

  if (
    typeof CSS !== "undefined" &&
    typeof CSS.escape === "function"
  ) {
    return CSS.escape(text);
  }

  return text.replace(/["\\]/g, "\\$&");
}
