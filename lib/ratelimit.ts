const attempts = new Map<string, { count: number; resetAt: number }>();

/** Потолок числа ключей: память ограничена даже при потоке запросов с разными ключами. */
const MAX_KEYS = 5_000;

/** Убрать истёкшие записи; если всё ещё слишком много — самые старые (Map хранит порядок вставки). */
function prune(now: number) {
  for (const [k, r] of attempts) if (r.resetAt < now) attempts.delete(k);
  for (const k of attempts.keys()) {
    if (attempts.size < MAX_KEYS) break;
    attempts.delete(k);
  }
}

export function rateLimit(key: string, limit = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.resetAt < now) {
    if (!rec && attempts.size >= MAX_KEYS) prune(now);
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (rec.count >= limit) return false;
  rec.count += 1;
  return true;
}
