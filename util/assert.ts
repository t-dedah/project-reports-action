/**
 * Assert that `value` is a finite number.
 *
 * @param value The value to assert is a number
 * @param label A value label to use in the error
 */
export function assertNumber(value: unknown, label = 'value'): number {
  if (typeof value !== 'number' || !isFinite(value)) {
    throw new Error(`${label} is not a number`)
  }

  return value
}

/**
 * Assert that `value` is a string.
 *
 * @param value The value to assert is a string
 * @param label A value label to use in the error
 */
export function assertString(value: unknown, label = 'value'): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} is not a string`)
  }

  return value
}
