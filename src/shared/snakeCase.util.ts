// file: src/shared/snakeCase.util.ts
export function snakeCase(s: string) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s\-]+/g, '_')
    .toLowerCase();
}
