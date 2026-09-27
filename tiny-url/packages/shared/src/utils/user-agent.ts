export interface ParsedUserAgentLight {
  browser: string;
  os: string;
  device: string;
}

export function parseUserAgentLight(ua: string): ParsedUserAgentLight {
  if (!ua) {
    return { browser: 'Unknown', os: 'Unknown', device: 'Desktop' };
  }

  let browser = 'Unknown';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('curl/')) browser = 'cURL';

  let os = 'Unknown';
  if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS') || ua.includes('Macintosh')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';

  let device = 'Desktop';
  if (ua.includes('iPad') || ua.includes('Tablet')) device = 'Tablet';
  else if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) device = 'Mobile';

  return { browser, os, device };
}
