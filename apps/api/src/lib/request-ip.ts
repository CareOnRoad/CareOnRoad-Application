// Production only listens on 127.0.0.1 behind the Cloudflare tunnel, so Cloudflare's header is authoritative.
// X-Forwarded-For/X-Real-IP stay as a local-dev fallback; clients can forge them when hit directly.
export function getRequestIp(request: Request): string | undefined {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) {
    return cloudflareIp;
  }

  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedIp) {
    return forwardedIp;
  }

  return request.headers.get("x-real-ip")?.trim() || undefined;
}
