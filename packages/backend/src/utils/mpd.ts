export function parseKeyValue(msg: string): Record<string, string> {
  const data: Record<string, string> = {};
  for (const line of msg.split("\n")) {
    const idx = line.indexOf(": ");
    if (idx !== -1) {
      data[line.slice(0, idx)] = line.slice(idx + 2);
    }
  }
  return data;
}

export function hashFile(file: string): number {
  let hash = 0;
  for (let i = 0; i < file.length; i++) {
    hash = (hash << 5) - hash + file.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
