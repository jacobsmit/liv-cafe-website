// Joins a path onto BASE_URL without producing a doubled slash.
// Astro's BASE_URL has no trailing slash for a subpath (e.g. "/liv-cafe-website")
// but is exactly "/" at the domain root, so a raw `${BASE_URL}/x` template
// produces "//x" once the site moves to a root domain. Stripping the
// trailing slash first keeps this correct in both cases.
export function withBase(path: string): string {
	const base = import.meta.env.BASE_URL.replace(/\/$/, '');
	return `${base}${path}`;
}
