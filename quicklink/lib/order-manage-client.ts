export function orderReference(id: string) {
  return `QL-${id.replaceAll('-', '').slice(-6).toUpperCase()}`
}
