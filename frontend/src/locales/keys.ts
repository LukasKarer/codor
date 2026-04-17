import de from './de'

type NestedKeyPaths<T, Prefix extends string = ''> = {
  [K in keyof T]: T[K] extends string
    ? `${Prefix}${K & string}`
    : NestedKeyPaths<T[K], `${Prefix}${K & string}.`>
}

function createKeys<T extends object>(obj: T, prefix = ''): NestedKeyPaths<T> {
  const result: Record<string, unknown> = {}
  for (const key in obj) {
    const val = obj[key as keyof T]
    const fullKey = prefix ? `${prefix}.${key}` : key
    result[key] =
      typeof val === 'object' && val !== null
        ? createKeys(val as object, fullKey)
        : fullKey
  }
  return result as NestedKeyPaths<T>
}

export const L = createKeys(de)
