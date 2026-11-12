/** 1,23,456 (Indian grouping), as on the web. */
export function inr(n: number): string {
  const digits = String(Math.round(Math.abs(n)));
  if (digits.length <= 3) return (n < 0 ? "-" : "") + digits;
  let head = digits.slice(0, -3);
  const groups: string[] = [];
  while (head.length > 2) {
    groups.unshift(head.slice(-2));
    head = head.slice(0, -2);
  }
  return (n < 0 ? "-" : "") + [head, ...groups, digits.slice(-3)].filter(Boolean).join(",");
}

/** One or two letters for an avatar: first and last name's first letters, any script. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = Array.from(parts[0])[0] ?? "";
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";
  return (first + last).toUpperCase();
}
