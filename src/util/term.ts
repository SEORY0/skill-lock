const CODES = {
  red: "31",
  yellow: "33",
  green: "32",
  dim: "2",
  bold: "1",
} as const;

export type ColorKind = keyof typeof CODES;

export function color(kind: ColorKind, text: string, enabled: boolean): string {
  return enabled ? `[${CODES[kind]}m${text}[0m` : text;
}

export function colorEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NO_COLOR === undefined && env.TERM !== "dumb" && process.stdout.isTTY === true;
}
