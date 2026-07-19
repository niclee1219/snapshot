export const RESERVED_SLUGS = new Set([
  "www",
  "api",
  "admin",
  "mail",
  "email",
  "app",
  "cdn",
  "media",
  "static",
  "assets",
  "img",
  "images",
  "dev",
  "staging",
  "test",
  "demo",
  "blog",
  "shop",
  "store",
  "help",
  "support",
  "status",
  "docs",
  "dashboard",
  "login",
  "signin",
  "signup",
  "register",
  "account",
  "billing",
  "ftp",
  "smtp",
  "imap",
  "pop",
  "ns1",
  "ns2",
  "mx",
  "webmail",
  "autodiscover",
  "root",
  "system",
  "internal",
  "pixolateds",
]);

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

export function validateCompanySlug(slug: string): string | null {
  if (!SLUG_PATTERN.test(slug)) {
    return "Use 3-30 lowercase letters, numbers or hyphens (no leading/trailing hyphen).";
  }
  if (slug.includes("--")) {
    return "Consecutive hyphens are not allowed.";
  }
  if (RESERVED_SLUGS.has(slug)) {
    return "This name is reserved. Please pick another.";
  }
  return null;
}

/** "Summer Gala 2026!" -> "summer-gala-2026" */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
