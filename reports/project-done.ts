import moment from 'moment'
import * as os from 'os'
import tablemark from 'tablemark'
import {CrawlingTarget} from '../interfaces'
import * as rptLib from '../project-reports-lib'
import {IssueList, ProjectIssue} from '../project-reports-lib'
import {getConfigValue, UserConfig} from '../util/config'

const now = moment()

export const reportType = 'project'

export type ProjectDoneConfig = {
  'report-on-label': string
  daysAgo: number
}

/*
 * Gives visibility into whether the team has untriaged debt, an approval bottleneck and
 * how focused the team is (e.g. how many efforts are going on)
 * A wip is a work in progress unit of resourcing.  e.g. it may be one developer or it might mean 4 developers.
 */
export function getDefaultConfiguration(): ProjectDoneConfig {
  return {
    'report-on-label': 'Feature',
    daysAgo: 7
  }
}

export type CompletedCards = {
  cardType: string
  daysAgo: number
  cards: ProjectIssue[]
}

export function process(
  config: UserConfig,
  issueList: IssueList
): CompletedCards {
  console.log('> project-done::process')

  const cardType = getConfigValue(config, 'report-on-label', 'string')
  const daysAgo = getConfigValue(config, 'daysAgo', 'number', 7)
  const daysAgoMoment = moment().subtract(daysAgo, 'days')

  console.log(`Getting cards for ${cardType}`)

  const issues = issueList.getItems()
  const cardsForType =
    cardType === '*'
      ? issues
      : rptLib.filterByLabel(issues, cardType.toLowerCase())

  const cards = cardsForType.filter(
    issue =>
      issue['project_done_at'] &&
      moment(issue['project_done_at']).isAfter(daysAgoMoment)
  )

  return {
    cardType,
    daysAgo,
    cards
  }
}

interface CompletedRow {
  assigned: string
  title: string
  completed: string
}

export function renderMarkdown(
  _targets: CrawlingTarget[],
  processedData: CompletedCards
): string {
  console.log('> project-done::renderMarkdown')
  const completedCards = processedData

  const lines: string[] = []
  const typeLabel =
    processedData.cardType === '*' ? '' : `${completedCards.cardType}s`

  lines.push(
    `## :checkered_flag: Completed ${typeLabel} last ${completedCards.daysAgo} days  `
  )
  lines.push('  ')

  const rows: CompletedRow[] = []

  for (const card of processedData.cards) {
    let assignee = card.assignee
    if (!assignee && card.assignees && card.assignees.length > 0) {
      assignee = card.assignees[0]
    }

    const assigned = assignee
      ? `<img height="20" width="20" alt="@${assignee.login}" src="${assignee.avatar_url}"/> <a href="${assignee.html_url}">${assignee.login}</a>`
      : ':triangular_flag_on_post:'

    const title = `[${card.title}](${card.html_url})`
    const completed = now.to(moment(card['project_done_at']))

    rows.push({
      assigned,
      title,
      completed
    })
  }

  let table: string
  if (rows && rows.length > 0) {
    table = tablemark(rows)
  } else {
    table = `No ${completedCards.cardType}s found.`
  }

  lines.push(table)
  lines.push('  ')

  return lines.join(os.EOL)
}

export function renderHtml(): string {
  // Not supported yet
  return ''
}
