export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const GH_BASE = "https://raw.githubusercontent.com/LuckDragonAsgard/schoolsportportal/main";
    
    // Pages served from GitHub (always latest)
    const ghPages = ["/williamstowndistrict.html", "/hobsonsbaydivision.html", "/index.html"];
    
    // Normalise: /williamstowndistrict -> /williamstowndistrict.html
    let normPath = path;
    if (!normPath.includes(".") && normPath !== "/") {
      normPath = normPath + ".html";
    }
    // Root -> index.html
    if (normPath === "/") {
      normPath = "/index.html";
    }

    if (ghPages.includes(normPath)) {
      const ghResponse = await fetch(GH_BASE + normPath, { cf: { cacheTtl: 60 } });
      const html = await ghResponse.text();
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60",
          "X-Robots-Tag": "index, follow",
          "X-Source": "github-latest"
        }
      });
    }

    // Everything else: proxy to CF Pages deployment
    const targetUrl = "https://2233d7af.schoolsportportal.pages.dev" + path + url.search;
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "follow"
    });
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }
}