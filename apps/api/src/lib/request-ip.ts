export function getRequestIp(request: Request): string | undefined {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();

  if (forwardedIp) {
    return forwardedIp;
  }

  return request.headers.get("x-real-ip")?.trim() || undefined;
}
