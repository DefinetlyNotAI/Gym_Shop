/** Date inputs represent whole business days in the release's Amman UTC+03 policy. */
export function analyticsQuery(input: URLSearchParams): URLSearchParams {
  const query = new URLSearchParams(input);
  for (const [key, time] of [
    ["from", "00:00:00.000"],
    ["to", "23:59:59.999"],
  ] as const) {
    const value = query.get(key);
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value))
      query.set(key, `${value}T${time}+03:00`);
  }
  return query;
}
