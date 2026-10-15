export function isThrottledMessage(message: string): boolean {
  return /throttl|too many requests/i.test(message);
}

export function parseRetrySeconds(message: string): number | null {
  const match = message.match(/(\d+)\s*seconds?/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}
