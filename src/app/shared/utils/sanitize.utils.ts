export function stripForbiddenChars(value: string): string {
  return value.replace(/[<>"'`&\\]/g, '');
}
