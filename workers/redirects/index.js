// ── legacy-redirects: retired databayt hostnames → where the product lives now ─
//
// These hostnames still sit in old links, CVs and GitHub repo homepages, and
// answered Vercel's DEPLOYMENT_NOT_FOUND after the Vercel account went down.
// One Worker owns them (custom_domain) and 301s each to its live home,
// keeping the path and query. $0: a redirect never touches a container.
// Add a hostname: a line in HOSTS + a route in wrangler.jsonc, then deploy.

const HOSTS = {
  "ed.databayt.org": "https://balqalam.com", // hogwarts moved to balqalam.com (2026-09)
  "wa.databayt.org": "https://ec.databayt.org", // souq/wathba storefront
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = HOSTS[url.hostname];
    if (!target) return new Response("Not found", { status: 404 });
    return Response.redirect(`${target}${url.pathname}${url.search}`, 301);
  },
};
