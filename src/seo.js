import { useEffect } from "react";

export const REACHFLY_SITE_URL =
  normalizeSiteUrl(
    import.meta.env?.VITE_SITE_URL ||
      "https://www.reachflyai.com"
  );

const DEFAULT_ROBOTS =
  "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

const JSON_LD_ID =
  "reachfly-route-json-ld";

export function useSEO({
  title,
  description,
  path = "/",
  canonical,
  robots = DEFAULT_ROBOTS,
  jsonLd,
  image,
  type = "website",
  noindex = false,
}) {
  useEffect(() => {
    if (
      typeof document ===
      "undefined"
    ) {
      return undefined;
    }

    const resolvedCanonical =
      absoluteUrl(
        canonical ||
          path ||
          "/"
      );

    const resolvedImage =
      image
        ? absoluteUrl(
            image
          )
        : "";

    const resolvedRobots =
      noindex
        ? "noindex,nofollow"
        : robots ||
          DEFAULT_ROBOTS;

    if (title) {
      document.title =
        title;
    }

    upsertMeta(
      "name",
      "description",
      description
    );

    upsertMeta(
      "name",
      "robots",
      resolvedRobots
    );

    upsertMeta(
      "property",
      "og:site_name",
      "ReachFly.AI"
    );

    upsertMeta(
      "property",
      "og:title",
      title
    );

    upsertMeta(
      "property",
      "og:description",
      description
    );

    upsertMeta(
      "property",
      "og:url",
      resolvedCanonical
    );

    upsertMeta(
      "property",
      "og:type",
      type ||
        "website"
    );

    if (
      resolvedImage
    ) {
      upsertMeta(
        "property",
        "og:image",
        resolvedImage
      );
    } else {
      removeMeta(
        "property",
        "og:image"
      );
    }

    upsertMeta(
      "name",
      "twitter:card",
      resolvedImage
        ? "summary_large_image"
        : "summary"
    );

    upsertMeta(
      "name",
      "twitter:title",
      title
    );

    upsertMeta(
      "name",
      "twitter:description",
      description
    );

    if (
      resolvedImage
    ) {
      upsertMeta(
        "name",
        "twitter:image",
        resolvedImage
      );
    } else {
      removeMeta(
        "name",
        "twitter:image"
      );
    }

    upsertCanonical(
      resolvedCanonical
    );

    upsertJsonLd(
      jsonLd
    );

    return () => {
      /*
       * Keep normal title/meta/canonical tags in place between client-side
       * transitions to avoid a flash of empty metadata. Only route-owned JSON-LD
       * is removed because stale structured data should never survive navigation.
       */
      removeJsonLd();
    };
  }, [
    canonical,
    description,
    image,
    jsonLd,
    noindex,
    path,
    robots,
    title,
    type,
  ]);
}

export function absoluteUrl(
  value = "/"
) {
  const text =
    String(
      value ||
        "/"
    ).trim();

  if (
    /^https?:\/\//i.test(
      text
    )
  ) {
    return text;
  }

  const path =
    text.startsWith("/")
      ? text
      : `/${text}`;

  return `${REACHFLY_SITE_URL}${path}`;
}

export function canonicalPath(
  value = "/"
) {
  const text =
    String(
      value ||
        "/"
    ).trim();

  if (!text) {
    return "/";
  }

  try {
    if (
      /^https?:\/\//i.test(
        text
      )
    ) {
      const url =
        new URL(
          text
        );

      return (
        url.pathname ||
        "/"
      );
    }
  } catch {
    return "/";
  }

  return text.startsWith("/")
    ? text
    : `/${text}`;
}

function normalizeSiteUrl(
  value
) {
  const fallback =
    "https://www.reachflyai.com";

  const text =
    String(
      value ||
        fallback
    )
      .trim()
      .replace(
        /\/+$/,
        ""
      );

  if (
    !/^https?:\/\//i.test(
      text
    )
  ) {
    return fallback;
  }

  return text;
}

function upsertMeta(
  attr,
  key,
  content
) {
  if (
    !content
  ) {
    removeMeta(
      attr,
      key
    );

    return;
  }

  let tag =
    document.head.querySelector(
      `meta[${attr}="${escapeSelectorValue(
        key
      )}"]`
    );

  if (!tag) {
    tag =
      document.createElement(
        "meta"
      );

    tag.setAttribute(
      attr,
      key
    );

    document.head.appendChild(
      tag
    );
  }

  tag.setAttribute(
    "content",
    String(
      content
    )
  );
}

function removeMeta(
  attr,
  key
) {
  document.head
    .querySelector(
      `meta[${attr}="${escapeSelectorValue(
        key
      )}"]`
    )
    ?.remove();
}

function upsertCanonical(
  href
) {
  if (!href) {
    return;
  }

  let link =
    document.head.querySelector(
      'link[rel="canonical"]'
    );

  if (!link) {
    link =
      document.createElement(
        "link"
      );

    link.rel =
      "canonical";

    document.head.appendChild(
      link
    );
  }

  link.href =
    href;
}

function upsertJsonLd(
  data
) {
  removeJsonLd();

  if (!data) {
    return;
  }

  const items =
    Array.isArray(
      data
    )
      ? data
      : [
          data,
        ];

  const validItems =
    items.filter(
      Boolean
    );

  if (
    !validItems.length
  ) {
    return;
  }

  const script =
    document.createElement(
      "script"
    );

  script.id =
    JSON_LD_ID;

  script.type =
    "application/ld+json";

  script.textContent =
    JSON.stringify(
      validItems.length ===
        1
        ? validItems[0]
        : validItems
    );

  document.head.appendChild(
    script
  );
}

function removeJsonLd() {
  document.getElementById(
    JSON_LD_ID
  )?.remove();
}

function escapeSelectorValue(
  value
) {
  const text =
    String(
      value ||
        ""
    );

  if (
    typeof CSS !==
      "undefined" &&
    typeof CSS.escape ===
      "function"
  ) {
    return CSS.escape(
      text
    );
  }

  return text.replace(
    /["\\]/g,
    "\\$&"
  );
}
