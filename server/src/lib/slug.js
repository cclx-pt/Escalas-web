/**
 * lib/slug.js — geração de slugs URL-safe a partir de nomes.
 */
export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Garante unicidade acrescentando um sufixo numérico se necessário. */
export function uniqueSlug(base, existing = []) {
  const set = new Set(existing)
  let slug = slugify(base) || 'item'
  let candidate = slug
  let i = 2
  while (set.has(candidate)) {
    candidate = `${slug}-${i}`
    i += 1
  }
  return candidate
}
