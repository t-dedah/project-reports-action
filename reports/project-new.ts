import moment from 'moment'
import * as os from 'os'
import tablemark from 'tablemark'
import {CrawlingTarget} from '../interfaces'
import * as rptLib from '../project-reports-lib'
import {IssueList, ProjectIssue} from '../project-reports-lib'

const now = moment()

const reportType = 'project'
export {reportType}

/*
 * Gives visibility into whether the team has untriaged debt, an approval bottleneck and
 * how focused the team is (e.g. how many efforts are going on)
 * A wip is a work in progress unit of resourcing.  e.g. it may be one developer or it might mean 4 developers.
 */
export function getDefaultConfiguration(): any {
  return <any>{
    'report-on-label': 'Feature',
    daysAgo: 7
  }
}

export type NewCards = {
  cardType: string
  daysAgo: number
  cards: ProjectIssue[]
}

export function process(
  config: any,
  issueList: IssueList,
  drillIn: (identifier: string, title: string, cards: ProjectIssue[]) => void
): any {
  console.log('> project-new::process')
  const newCards = <NewCards>{}

  newCards.cardType = config['report-on'] || config['report-on-label']

  const daysAgo = config['daysAgo'] || 7
  if (isNaN(daysAgo)) {
    throw new Error('daysAgo is not a number')
  }
  newCards.daysAgo = daysAgo

  const daysAgoMoment = moment().subtract(config['daysAgo'] || 7, 'days')

  console.log(`Getting cards for ${newCards.cardType} added > ${daysAgoMoment}`)

  const issues = issueList.getItems()
  const cardsForType =
    newCards.cardType === '*'
      ? issues
      : (rptLib.filterByLabel(issues, newCards.cardType.toLowerCase()) as ProjectIssue[])
  newCards.cards = cardsForType.filter(
    issue => issue['project_added_at'] && moment(issue['project_added_at']).isAfter(daysAgoMoment)
  )

  return newCards
}

interface NewRow {
  assigned: string
  title: string
  added: string
}

export function renderMarkdown(targets: CrawlingTarget[], processedData: any): string {
  console.log('> in-progress::renderMarkdown')
  const newCards = processedData as NewCards

  const lines: string[] = []
  const typeLabel = processedData.cardType === '*' ? '' : `${newCards.cardType}s`

  lines.push(`## :wave: Added ${typeLabel} last ${newCards.daysAgo} days  `)
  lines.push('  ')

  const rows: NewRow[] = []
  for (const card of processedData.cards) {
    const newRow = <NewRow>{}

    let assigned = card.assignee
    if (!assigned && card.assignees && card.assignees.length > 0) {
      assigned = card.assignees[0]
    }

    newRow.assigned = assigned
      ? `<img height="20" width="20" alt="@${assigned.login}" src="${assigned.avatar_url}"/> <a href="${assigned.html_url}">${assigned.login}</a>`
      : ':triangular_flag_on_post:'
    newRow.title = `[${card.title}](${card.html_url})`
    newRow.added = now.to(moment(card['project_added_at']))

    rows.push(newRow)
  }

  let table: string
  if (rows && rows.length > 0) {
    table = tablemark(rows)
  } else {
    table = `No ${newCards.cardType}s found.`
  }

  lines.push(table)
  lines.push('  ')

  return lines.join(os.EOL)
}

export function renderHtml(): string {
  // Not supported yet
  return ''
}
