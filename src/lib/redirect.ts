/** Restore a path saved by public/404.html on static hosts that only serve index.html at /. */
export function restoreStaticRedirect(): void {
  const url = new URL(window.location.href);
  const encoded = url.searchParams.get("p");
  if (!encoded) return;
  url.searchParams.delete("p");
  const leftover = url.searchParams.toString();
  const hashIndex = encoded.indexOf("#");
  const beforeHash = hashIndex >= 0 ? encoded.slice(0, hashIndex) : encoded;
  const hash = hashIndex >= 0 ? encoded.slice(hashIndex) : "";
  const queryIndex = beforeHash.indexOf("?");
  const path = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : "";
  const params = new URLSearchParams(query);
  if (leftover) {
    new URLSearchParams(leftover).forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
  }
  const search = params.toString();
  const next = `/${path.replace(/^\/+/, "")}${search ? `?${search}` : ""}${hash}`;
  window.history.replaceState(null, "", next);
}
