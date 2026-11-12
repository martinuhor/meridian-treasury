/** Ephemeral Try-demo subjects never touch Postgres. */
export function isDemoSubject(subject: string | null | undefined): boolean {
  return Boolean(subject?.startsWith("demo:"));
}
