export interface WebSearchResult {
    title: string;
    url: string;
    snippet: string;
}

export interface WebSearchResponse {
    query: string;
    results: WebSearchResult[];
    source?: string;
}

/**
 * Perform a web search across available search providers with fallback.
 * 1. Tavily / Brave / SearXNG / Serper if environment / config is provided.
 * 2. Zero-config Bing HTML scraping with base64 URL resolution.
 * 3. Zero-config Wikipedia API as fallback.
 */
export async function performWebSearch(
    query: string,
    limit = 5,
    options: {
        braveApiKey?: string;
        tavilyApiKey?: string;
        serperApiKey?: string;
        searxngUrl?: string;
    } = {}
): Promise<WebSearchResponse> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
        return { query: "", results: [] };
    }

    const braveKey = options.braveApiKey || process.env.BRAVE_API_KEY;
    const tavilyKey = options.tavilyApiKey || process.env.TAVILY_API_KEY;
    const serperKey = options.serperApiKey || process.env.SERPER_API_KEY;
    const searxngUrl = options.searxngUrl || process.env.SEARXNG_URL;

    // 1. Tavily API if configured
    if (tavilyKey) {
        try {
            const res = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tavilyKey}`
                },
                body: JSON.stringify({ query: trimmedQuery, max_results: limit }),
                signal: AbortSignal.timeout(5000)
            });
            if (res.ok) {
                const data = (await res.json()) as {
                    results?: Array<{ title?: string; url?: string; content?: string }>;
                };
                if (Array.isArray(data.results) && data.results.length > 0) {
                    return {
                        query: trimmedQuery,
                        source: "tavily",
                        results: data.results.slice(0, limit).map((r) => ({
                            title: r.title || "",
                            url: r.url || "",
                            snippet: r.content || ""
                        }))
                    };
                }
            }
        } catch {
            // Fall through to next provider
        }
    }

    // 2. Brave Search API if configured
    if (braveKey) {
        try {
            const res = await fetch(
                `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(trimmedQuery)}&count=${limit}`,
                {
                    headers: {
                        Accept: "application/json",
                        "X-Subscription-Token": braveKey
                    },
                    signal: AbortSignal.timeout(5000)
                }
            );
            if (res.ok) {
                const data = (await res.json()) as {
                    web?: {
                        results?: Array<{ title?: string; url?: string; description?: string }>;
                    };
                };
                if (Array.isArray(data.web?.results) && data.web!.results.length > 0) {
                    return {
                        query: trimmedQuery,
                        source: "brave",
                        results: data.web!.results.slice(0, limit).map((r) => ({
                            title: r.title || "",
                            url: r.url || "",
                            snippet: r.description || ""
                        }))
                    };
                }
            }
        } catch {
            // Fall through to next provider
        }
    }

    // 3. Serper API if configured
    if (serperKey) {
        try {
            const res = await fetch("https://google.serper.dev/search", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-KEY": serperKey
                },
                body: JSON.stringify({ q: trimmedQuery, num: limit }),
                signal: AbortSignal.timeout(5000)
            });
            if (res.ok) {
                const data = (await res.json()) as {
                    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
                };
                if (Array.isArray(data.organic) && data.organic.length > 0) {
                    return {
                        query: trimmedQuery,
                        source: "serper",
                        results: data.organic.slice(0, limit).map((r) => ({
                            title: r.title || "",
                            url: r.link || "",
                            snippet: r.snippet || ""
                        }))
                    };
                }
            }
        } catch {
            // Fall through to next provider
        }
    }

    // 4. SearXNG if configured
    if (searxngUrl) {
        try {
            const res = await fetch(
                `${searxngUrl.replace(/\/$/, "")}/search?q=${encodeURIComponent(trimmedQuery)}&format=json`,
                {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    },
                    signal: AbortSignal.timeout(5000)
                }
            );
            if (res.ok) {
                const data = (await res.json()) as {
                    results?: Array<{ title?: string; url?: string; content?: string }>;
                };
                if (Array.isArray(data.results) && data.results.length > 0) {
                    return {
                        query: trimmedQuery,
                        source: "searxng",
                        results: data.results.slice(0, limit).map((r) => ({
                            title: r.title || "",
                            url: r.url || "",
                            snippet: r.content || ""
                        }))
                    };
                }
            }
        } catch {
            // Fall through to next provider
        }
    }

    // 5. Zero-config Bing Web Scraper (Fast, reliable, global)
    try {
        const res = await fetch(
            `https://www.bing.com/search?q=${encodeURIComponent(trimmedQuery)}`,
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept-Language": "en-US,en;q=0.9"
                },
                signal: AbortSignal.timeout(5000)
            }
        );
        if (res.ok) {
            const html = await res.text();
            const results: WebSearchResult[] = [];
            const liMatches = [...html.matchAll(/<li class="b_algo"[^>]*>(.*?)<\/li>/gs)];
            for (const match of liMatches.slice(0, limit)) {
                const liContent = match[1];
                const aMatch = liContent.match(
                    /<h2[^>]*>\s*<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/s
                );
                const pMatch = liContent.match(/<p[^>]*>(.*?)<\/p>/s);
                if (aMatch) {
                    let url = aMatch[1].replace(/&amp;/g, "&");
                    const title = aMatch[2]
                        .replace(/<[^>]+>/g, "")
                        .replace(/&amp;/g, "&")
                        .replace(/&#183;/g, "·")
                        .replace(/&#228;/g, "ä")
                        .replace(/&#252;/g, "ü")
                        .trim();
                    const snippet = pMatch
                        ? pMatch[1]
                              .replace(/<[^>]+>/g, "")
                              .replace(/&amp;/g, "&")
                              .replace(/&nbsp;/g, " ")
                              .trim()
                        : "";

                    // Decode Bing tracking base64 parameter u=a1...
                    const uParam = url.match(/[?&]u=a1([^&]+)/);
                    if (uParam) {
                        try {
                            url = Buffer.from(uParam[1], "base64").toString("utf-8");
                        } catch {
                            // Keep original url
                        }
                    }
                    results.push({ title, url, snippet });
                }
            }

            if (results.length > 0) {
                return {
                    query: trimmedQuery,
                    source: "bing",
                    results
                };
            }
        }
    } catch {
        // Fall through to Wikipedia
    }

    // 6. Zero-config Wikipedia API fallback
    try {
        const wikiRes = await fetch(
            `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(trimmedQuery)}&format=json`,
            {
                headers: { "User-Agent": "RYNArouter/1.0" },
                signal: AbortSignal.timeout(4000)
            }
        );
        if (wikiRes.ok) {
            const data = (await wikiRes.json()) as {
                query?: { search?: Array<{ title?: string; snippet?: string }> };
            };
            const searchList = data.query?.search || [];
            if (searchList.length > 0) {
                return {
                    query: trimmedQuery,
                    source: "wikipedia",
                    results: searchList.slice(0, limit).map((item) => ({
                        title: item.title || "",
                        url: `https://en.wikipedia.org/wiki/${encodeURIComponent((item.title || "").replace(/ /g, "_"))}`,
                        snippet: (item.snippet || "").replace(/<[^>]+>/g, "").trim()
                    }))
                };
            }
        }
    } catch {
        // All providers failed
    }

    return {
        query: trimmedQuery,
        results: []
    };
}
