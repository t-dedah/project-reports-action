import * as os from 'os'
import {CrawlingTarget} from '../interfaces'
import {UserConfig} from '../util/config'

export const reportType = 'any'

export type EchoBoardConfig = {
  'add-age': string
}

export function getDefaultConfiguration(): EchoBoardConfig {
  return {
    'add-age': 'days'
  }
}

// processing the data does a js map on each items and adds data that the report rendering (generate) needs
// we will dump the json data used to generate the reports next to the rendered report
// e.g. this function should look at the transition times and added wip status of yellow, red etc.
export function process<T>(config: UserConfig, data: T): T {
  // TODO: process and add age in hours
  if (config) {
    return data
  }
  return data
}

export function renderMarkdown<T>(targets: CrawlingTarget[], data: T): string {
  console.log(`rendering for ${targets.length} targets`)

  const lines: string[] = []
  lines.push(`## Echo data `)

  lines.push('')
  lines.push('```javascript')
  lines.push(JSON.stringify(data, null, 2))
  lines.push('```')
  // TODO

  return lines.join(os.EOL)
}

export function renderHtml(): string {
  // Not supported yet
  return ''
}
