import {assertNumber, assertString} from './assert'

export type UserConfig = Record<string, unknown>

export function getConfigValue(
  config: UserConfig,
  key: string,
  type: 'string',
  defaultValue?: string
): string
export function getConfigValue(
  config: UserConfig,
  key: string,
  type: 'number',
  defaultValue?: number
): number
export function getConfigValue(
  config: UserConfig,
  key: string,
  type: 'string' | 'number',
  defaultValue?: string | number
): string | number {
  const value = config[key] ?? defaultValue

  switch (type) {
    case 'string':
      return assertString(value, key)
    case 'number':
      return assertNumber(value, key)
  }
}
