import * as os from 'os'
import {ProjectIssue} from '../project-reports-lib'

export function renderMarkdown(heading: string, cards: ProjectIssue[]): string {
  const lines: string[] = []

  lines.push(`## ${heading}`)

  // create a report for each type.  e.g. "Epic"
  for (const card of cards) {
    // note: the two spaces at the end of markdown strings are intentional for markdown new lines.  don't trim :)
    lines.push(`  `)
    const assigneeHtml = card.assignee
      ? `<img height="20" width="20" alt="@${card.assignee.login}" src="${card.assignee.avatar_url}"/>`
      : ''

    // ### <img height="20" width="20" alt="@bryanmacfarlane" src="https://avatars3.githubusercontent.com/u/919564?v=4"/> [Initial Web UI](https://github.com/bryanmacfarlane/quotes-feed/issues/13)
    // > [@bryanmacfarlane](https://github.com/bryanmacfarlane)
    //   `1-dev` `epic`

    lines.push(`### ${assigneeHtml} [${card.title}](${card.html_url})  `)
    const assigneeLink = card.assignee
      ? `[@${card.assignee.login}](${card.assignee.html_url})  `
      : 'not assigned  '
    lines.push(`> ${assigneeLink}`)

    const labels: string[] = []
    for (const label of card.labels) {
      labels.push(`\`${label.name}\``)
    }

    lines.push(`  ${labels.join(' ')}`)
  }

  return lines.join(os.EOL)
}

export function renderHtml(): string {
  // Not supported yet
  return ''
}
