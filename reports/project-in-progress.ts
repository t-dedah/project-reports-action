import clone from 'clone'
import moment from 'moment'
import * as os from 'os'
import tablemark from 'tablemark'
import {CrawlingTarget} from '../interfaces'
import * as rptLib from '../project-reports-lib'
import {IssueList, ProjectIssue, ProjectStageIssues, ProjectStages} from '../project-reports-lib'

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
    // Takes a single type since settings like daysAgo might be different by type.
    // Can add multiple sections on report if you want more
    'report-on-label': 'Feature',
    // TODO: implement getting a shapshot of data n days ago
    daysAgo: 7,
    'status-label-match': '(?:green|yellow|red)',
    'last-updated-days-flag': 3.0,
    'last-updated-scheme': 'LastCommentPattern',
    'last-updated-scheme-data': '^(#){1,4} [Uu]pdate',
    // last status a week before this wednesday (last wednesday)
    'status-day': 'Wednesday',
    'previous-days-ago': 7,
    'previous-hour-utc': 17
  }
}

export type ProgressData = {
  cardType: string
  cards: IssueCardEx[]
}

export interface IssueCardEx extends ProjectIssue {
  status: string
  previousStatus: string
  flagHoursLastUpdated: boolean
  lastUpdatedAt: string
  lastUpdatedAgo: string
  hoursInProgress: number
  inProgressSince: string
}

const statusLevels = {
  '': 0, // no status
  red: 1,
  yellow: 2,
  blocked: 3,
  green: 4
}

// sort by status
export function sortCards(card1: IssueCardEx, card2: IssueCardEx) {
  // Sort first on day
  if (statusLevels[card1.status] > statusLevels[card2.status]) {
    return 1
  } else if (statusLevels[card1.status] < statusLevels[card2.status]) {
    return -1
  } else {
    // if the status is the same
    // subsort by hours in progress

    if (card1.hoursInProgress < card2.hoursInProgress) {
      return 1
    } else if (card1.hoursInProgress > card2.hoursInProgress) {
      return -1
    } else {
      return 0
    }
  }
}

export function process(
  config: any,
  issueList: IssueList,
  drillIn: (identifier: string, title: string, cards: ProjectIssue[]) => void
): any {
  console.log('> in-progress::process')

  const progressData = <ProgressData>{}
  progressData.cardType = config['report-on'] || config['report-on-label']
  progressData.cards = []

  const issues = issueList.getItems()
  const projData: ProjectStageIssues = rptLib.getProjectStageIssues(issues)
  const cards = projData[ProjectStages.InProgress]
  if (!cards) {
    return progressData
  }

  console.log(`Getting cards for ${progressData.cardType}`)
  const cardsForType =
    progressData.cardType === '*'
      ? clone(cards)
      : clone(rptLib.filterByLabel(cards, progressData.cardType.toLowerCase()) as IssueCardEx[])

  const previousMoment = moment()
    .day(config['status-day'])
    .subtract(config['previous-days-ago'], 'days')
    .utc()
    .hour(config['previous-hour-utc'])
  console.log(`Previous status moment: ${previousMoment}`)

  // add status to each card from the status label
  cardsForType.map((card: IssueCardEx) => {
    console.log(`issue: ${card.html_url}`)
    const labels = card.labels.map(label => label.name)

    const lastUpdatedDate = rptLib.dataFromCard(card, config['last-updated-scheme'], config['last-updated-scheme-data'])
    console.log(`last updated: ${lastUpdatedDate}`)

    card.lastUpdatedAt = lastUpdatedDate
    card.lastUpdatedAgo = lastUpdatedDate ? now.to(lastUpdatedDate) : ''
    console.log(`lastUpdatedAgo: ${card.lastUpdatedAgo}`)

    const daysSinceUpdate = lastUpdatedDate ? now.diff(lastUpdatedDate, 'days') : -1
    card.flagHoursLastUpdated = daysSinceUpdate < 0 || daysSinceUpdate > config['last-updated-days-flag']

    const previousCard = issueList.getItemAsof(card.html_url, previousMoment.toDate())

    const status = rptLib.getStringFromLabel(card, new RegExp(config['status-label-match'])).toLowerCase()
    console.log(`status: '${status}' - '${config['status-label-match']}':${JSON.stringify(labels)}`)

    const previousStatus = rptLib
      .getStringFromLabel(previousCard, new RegExp(config['status-label-match']))
      .toLowerCase()
    console.log(`previousStatus: '${previousStatus}' - '${config['status-label-match']}':${JSON.stringify(labels)}`)

    card.status = statusLevels[status] ? status : ''
    card.previousStatus = statusLevels[previousStatus] ? previousStatus : ''
    card.hoursInProgress = -1
    if (card.project_in_progress_at) {
      const then = moment(card.project_in_progress_at)
      card.hoursInProgress = now.diff(then, 'hours', true)
      card.inProgressSince = now.to(then)
    }

    return card
  })

  cardsForType.sort(sortCards)

  progressData.cards = cardsForType

  return progressData
}

interface ProgressRow {
  assigned: string
  title: string
  status: string
  previous: string
  inProgress: string
  lastUpdated: string
}

// TODO: we could make this configurable
function getStatusEmoji(status: string) {
  let statusEmoji = ':exclamation:'
  switch (status.toLowerCase()) {
    case 'red':
      statusEmoji = ':heart:'
      break
    case 'green':
      statusEmoji = ':green_heart:'
      break
    case 'yellow':
      statusEmoji = ':yellow_heart:'
      break
  }

  return statusEmoji
}

export function renderMarkdown(targets: CrawlingTarget[], processedData: any): string {
  console.log('> in-progress::renderMarkdown')
  const progressData = processedData as ProgressData

  const lines: string[] = []
  const typeLabel = processedData.cardType === '*' ? '' : `${progressData.cardType}s`

  lines.push(`## :hourglass_flowing_sand: In Progress ${typeLabel}  `)
  lines.push(`<sub><sup>Sorted by status and then in progress time descending</sup></sub>  `)
  lines.push('  ')

  const rows: ProgressRow[] = []
  for (const card of processedData.cards) {
    const progressRow = <ProgressRow>{}

    let assigned = card.assignee
    if (!assigned && card.assignees && card.assignees.length > 0) {
      assigned = card.assignees[0]
    }

    progressRow.assigned = assigned
      ? `<img height="20" width="20" alt="@${assigned.login}" src="${assigned.avatar_url}"/> <a href="${assigned.html_url}">${assigned.login}</a>`
      : ':triangular_flag_on_post:'
    progressRow.title = `[${card.title}](${card.html_url})`
    progressRow.status = getStatusEmoji(card.status)
    progressRow.previous = getStatusEmoji(card.previousStatus)
    progressRow.lastUpdated = card.lastUpdatedAgo
    if (card.flagHoursLastUpdated) {
      progressRow.lastUpdated += ' :triangular_flag_on_post:'
    }

    progressRow.inProgress = card.inProgressSince

    rows.push(progressRow)
  }

  let table: string
  if (rows && rows.length > 0) {
    table = tablemark(rows)
  } else {
    table = `No ${progressData.cardType}s found.`
  }

  lines.push(table)
  lines.push('  ')

  return lines.join(os.EOL)
}

export function renderHtml(): string {
  // Not supported yet
  return ''
}
