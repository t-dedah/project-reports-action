import clone from 'clone'
import moment from 'moment'
import * as os from 'os'
import tablemark from 'tablemark'
import {CrawlingTarget} from '../interfaces'
import * as rptLib from '../project-reports-lib'
import {IssueList, ProjectIssue, ProjectStages} from '../project-reports-lib'

const reportType = 'project'
export {reportType}

export function getDefaultConfiguration(): any {
  return <any>{
    'report-on-label': 'Feature',
    'average-limit': 21,
    limit: 21,
    'bucket-count': 4,
    'bucket-days': 7,
    'window-days': 28
    // window-count also supported
  }
}

export type CycleTimeData = {[date: string]: CycleTimeEntry}
interface CycleTimeEntry {
  count: number
  averageCycleTime: number
  eightiethCycleTime: number
  flag: boolean
}

function getCycleTotal(issues: ProjectIssue[]): number {
  let cycleTotal = 0

  console.log()
  for (const issue of issues) {
    // const cycleTime = calculateCycleTime(issue)
    console.log(`${issue['cycle_time']} cycle time, done: ${issue.project_done_at}, ${issue.title}`)
    cycleTotal += issue['cycle_time']
  }

  return cycleTotal
}

function percentileCycleTime(percentile: number, issues: ProjectIssue[]): number {
  console.log(`${percentile} percentile for ${issues.length} done issues`)
  if (issues.length === 0) {
    return 0
  }

  const pos = ((issues.length - 1) * percentile) / 100
  const base = Math.floor(pos)
  const rest = pos - base

  let ct = issues[base]['cycle_time']
  if (issues[base + 1] !== undefined) {
    const nextCt = issues[base + 1]['cycle_time']
    console.log(`using ${rest.toFixed(2)} between index ${base} (${ct}) and ${base + 1} (${nextCt})`)
    ct = ct + rest * (nextCt - ct)
  }

  console.log(`${percentile}th: ${ct}`)

  return ct
}

export function process(
  config: any,
  issueList: IssueList,
  drillIn: (identifier: string, title: string, cards: ProjectIssue[]) => void
): any {
  const cycleTimeData = <CycleTimeData>{}
  const filtered = rptLib.filterByLabel(issueList.getItems(), config['report-on-label'])
  const issues = new IssueList(issue => issue.html_url)
  issues.add(filtered)

  const windowDays = config['window-days']
  const ago = moment()
  const windowAgo = moment()
  windowAgo.subtract(windowDays, 'days')

  for (let i = 0; i < config['bucket-count']; i++) {
    const label = ago.toISOString()

    console.log()
    console.log('|/-\\|/-\\|/-\\|/-\\|/-\\|/-\\|/-\\|/-\\|/-\\|/-\\|/-\\|/-\\|/-\\|/-\\|/-\\|/-\\|/-\\|/-\\|/-\\|/-\\')
    console.log(
      `Computing cycle-time asof ${ago.format('MMM Do YY')} for ${windowDays} back (${windowAgo.format('MMM Do YY')})`
    )

    const agoIssues = i == 0 ? issues.getItems() : issues.getItemsAsof(ago.toDate())

    // all issue done after the window of time ago
    // which has ever been in progress.  (closed proposed items automate to done column routinely)
    // get done issues within the sliding window
    // do a deep clone because we're going to mutate the issue by writing cycle_time to it later
    const doneIssues = clone(
      agoIssues.filter(
        issue =>
          issue.project_stage === ProjectStages.Done &&
          issue.project_in_progress_at &&
          new Date(issue.project_done_at).getTime() > windowAgo.toDate().getTime()
      )
    )

    console.log(`${doneIssues.length} issues done in that window`)
    //doneIssues.sort((a, b) => new Date(a.project_done_at).getTime() - new Date(b.project_done_at).getTime())
    doneIssues.map(issue => (issue['cycle_time'] = calculateCycleTime(issue)))
    // sort by cycle time to get percentiles
    doneIssues.sort((a, b) => new Date(a['cycle_time']).getTime() - new Date(b['cycle_time']).getTime())

    const cycleCount = doneIssues.length
    const cycleTotal = getCycleTotal(doneIssues)

    const averageCycleTime = cycleTotal / cycleCount || 0
    console.log(`avg: ${averageCycleTime} (${cycleTotal} / ${cycleCount})`)

    const eightieth = percentileCycleTime(80, doneIssues)

    cycleTimeData[label] = <CycleTimeEntry>{
      count: cycleCount,
      averageCycleTime: averageCycleTime,
      eightiethCycleTime: eightieth,
      flag: averageCycleTime > config['limit'] || config['average-limit']
    }

    ago.subtract(config['bucket-days'], 'days')
    // sliding window
    windowAgo.subtract(config['bucket-days'], 'days')
  }

  return cycleTimeData
}

interface CycleTimeRow {
  label: string
  count: number
  average: string
  eightieth: string
  flag: boolean
}

export function renderMarkdown(targets: CrawlingTarget[], processedData: any): string {
  const cycleTimeData = processedData as CycleTimeData
  const lines: string[] = []
  const rows: CycleTimeRow[] = []
  for (const key in processedData) {
    const entry = processedData[key]
    rows.push(<CycleTimeRow>{
      label: key,
      count: entry.count,
      average: entry.averageCycleTime.toFixed(2),
      eightieth: entry.eightiethCycleTime.toFixed(2),
      flag: entry.flag
    })
  }

  const table: string = tablemark(rows)
  lines.push(table)
  return lines.join(os.EOL)
}

//
// Calculate cycle time for a card
// The time, in days, a unit of work spends between the first day it is actively being worked on until the day it is closed.
// In this case, since a project card has events, we look for the event that moved or added a card to the "Accepted" column
// and subtract it from the time that the card moved to the `Done` column.
//
function calculateCycleTime(card: ProjectIssue): number {
  // cycle time starts at Accepted, ends at Done.
  const in_progress_at: Date = new Date(card.project_in_progress_at)
  const done_time: Date = new Date(card.project_done_at)

  if (in_progress_at == null || done_time == null) {
    return 0
  }

  return moment(done_time).diff(moment(in_progress_at), 'days', true)
}
