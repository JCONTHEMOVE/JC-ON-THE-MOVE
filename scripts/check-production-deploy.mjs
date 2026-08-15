import dns from "node:dns/promises";

const healthUrl = process.argv[2] || process.env.PUBLIC_HEALTH_URL || "https://www.jconthemove.com/api/health";
const expectedCommit = (process.env.EXPECTED_COMMIT || process.env.DEPLOY_GIT_COMMIT || process.env.RENDER_GIT_COMMIT || "").slice(0, 8) || null;
const expectedProvider = String(process.env.EXPECTED_HOSTING_PROVIDER ?? "railway").trim().toLowerCase();
const healthPath = new URL(healthUrl).pathname.replace(/\/+$/, "") || "/";
const platformHealth = healthPath === "/health" || healthPath === "/version";
const requestTimeoutMs = Number(process.env.DEPLOY_CHECK_TIMEOUT_MS || 15_000);

function header(res, name) {
  return res.headers.get(name) || "";
}

function hostSignals(res) {
  return [
    header(res, "x-railway-67") ? "railway" : "",
    header(res, "x-railway-edge") ? "railway" : "",
    header(res, "x-render-origin-server") ? "render" : "",
    header(res, "cf-ray") ? "cloudflare" : "",
  ].filter(Boolean);
}

function detectedProvider(signals) {
  if (signals.includes("railway")) return "railway";
  if (signals.includes("render")) return "render";
  return null;
}

async function getDnsSignals(url) {
  const hostname = new URL(url).hostname;
  const signals = [];

  try {
    const cnames = await dns.resolveCname(hostname);
    for (const cname of cnames) {
      signals.push(`cname=${cname}`);
    }
  } catch (error) {
    if (error?.code !== "ENODATA" && error?.code !== "ENOTFOUND") {
      signals.push(`dns=${error?.code || "lookup_failed"}`);
    }
  }

  return signals;
}

async function verifyMarketingQr(origin) {
  const headers = {
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  };
  const repsResponse = await fetch(`${origin}/api/marketing-network/reps`, {
    headers,
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  if (!repsResponse.ok) {
    throw new Error(`marketing rep lookup returned HTTP ${repsResponse.status}`);
  }

  const reps = await repsResponse.json();
  const slug = Array.isArray(reps)
    ? reps.find((rep) => typeof rep?.slug === "string" && rep.slug.length > 0)?.slug
    : null;
  if (!slug) throw new Error("no active marketing rep is available for the QR deployment check");

  const campaignId = `deploy-check-${expectedCommit || "current"}`;
  const qrUrl = new URL(`/api/marketing-network/reps/${encodeURIComponent(slug)}/qr.svg`, origin);
  qrUrl.searchParams.set("jc_campaign", campaignId);
  qrUrl.searchParams.set("jc_package", "deployment-check");
  const qrResponse = await fetch(qrUrl, {
    headers,
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const svg = await qrResponse.text();
  const destinationHeader = qrResponse.headers.get("x-qr-destination") || "";
  if (!qrResponse.ok) throw new Error(`QR endpoint returned HTTP ${qrResponse.status}`);
  if (!qrResponse.headers.get("content-type")?.includes("image/svg+xml") || !svg.includes("<svg")) {
    throw new Error("QR endpoint did not return an SVG image");
  }
  if (!destinationHeader) throw new Error("QR endpoint did not report its encoded destination");

  const destination = new URL(destinationHeader);
  if (destination.origin !== origin) throw new Error(`QR points outside the production website: ${destination.origin}`);
  if (destination.pathname !== `/network/${slug}`) throw new Error(`QR points to the wrong rep page: ${destination.pathname}`);
  if (destination.searchParams.get("jc_campaign") !== campaignId) throw new Error("QR dropped campaign attribution");
  if (destination.searchParams.get("jc_package") !== "deployment-check") throw new Error("QR dropped package attribution");

  const destinationResponse = await fetch(destination, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  if (!destinationResponse.ok) throw new Error(`QR destination returned HTTP ${destinationResponse.status}`);

  return `rep=${slug} destination=${destination.pathname} campaign=${campaignId}`;
}

try {
  const dnsSignals = await getDnsSignals(healthUrl);
  const signal = AbortSignal.timeout(Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0 ? requestTimeoutMs : 15_000);
  const res = await fetch(healthUrl, {
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
    signal,
  });
  const signals = hostSignals(res);
  const provider = detectedProvider(signals);
  const raw = await res.text();

  let body = null;
  let parseFailed = false;
  try {
    body = JSON.parse(raw);
  } catch {
    parseFailed = true;
    console.error(`[deploy-check] FAIL ${healthUrl}`);
    console.error(`status=${res.status}; hostSignals=${signals.join(",") || "none"}`);
    console.error("response was not JSON");
    process.exitCode = 1;
  }

  if (!parseFailed) {
    const publicCommit = body?.version?.shortCommit || null;
    const problems = [];
    let qrCheck = "not-run";
    if (expectedProvider && provider !== expectedProvider) {
      problems.push(`public domain is served by ${provider || "an unknown provider"}, expected ${expectedProvider}`);
    }
    if (expectedProvider && dnsSignals.length > 0 && !dnsSignals.some((signal) => signal.toLowerCase().includes(expectedProvider))) {
      problems.push(`DNS does not identify the expected ${expectedProvider} host`);
    }
    if (!body?.version) {
      problems.push("public health is missing the version block, so it is an older build");
    } else if (!publicCommit) {
      problems.push("public health has a version block but no commit marker");
    }
    if (expectedCommit && publicCommit && publicCommit !== expectedCommit) {
      problems.push(`public commit ${publicCommit} does not match expected ${expectedCommit}`);
    }
    if (platformHealth) {
      if (!res.ok || !["alive", "ready"].includes(body?.status)) {
        problems.push(`platform health not alive: http=${res.status} status=${body?.status || "unknown"}`);
      }
      if (body?.boot?.status === "failed") {
        problems.push(`application bootstrap failed: ${body?.boot?.error || "unknown error"}`);
      }
    } else if (!res.ok || body?.status !== "ready") {
      problems.push(`readiness health not ready: http=${res.status} status=${body?.status || "unknown"}`);
    }

    try {
      qrCheck = await verifyMarketingQr(new URL(healthUrl).origin);
    } catch (error) {
      problems.push(`marketing QR deployment check failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const summary = [
      `url=${healthUrl}`,
      `status=${res.status}`,
      `appStatus=${body?.status || "unknown"}`,
      `commit=${publicCommit || "missing"}`,
      `uptime=${body?.uptimeSeconds ?? "unknown"}`,
      `provider=${provider || "unknown"}`,
      `signals=${signals.join(",") || "none"}`,
      `dns=${dnsSignals.join(",") || "none"}`,
      `qr=${qrCheck}`,
    ].join(" ");

    if (problems.length > 0) {
      console.error(`[deploy-check] FAIL ${summary}`);
      for (const problem of problems) console.error(`- ${problem}`);
      process.exitCode = 1;
    } else {
      console.log(`[deploy-check] PASS ${summary}`);
    }
  }
} catch (error) {
  console.error(`[deploy-check] FAIL ${healthUrl}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
