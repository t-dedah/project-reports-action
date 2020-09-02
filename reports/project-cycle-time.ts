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
    'report-on-label': 'feature',
    'average-limit': 21,
    'bucket-days': 7,
    'bucket-count': 4
  }
}

export type CycleTimeData = {[date: string]: CycleTimeEntry}
interface CycleTimeEntry {
  count: number
  averageCycleTime: string
  flag: boolean
}

export function process(
  config: any,
  issueList: IssueList,
  drillIn: (identifier: string, title: string, cards: ProjectIssue[]) => void
): any {
  const now = moment()

  const cycleTimeData = <CycleTimeData>{}
  const filtered = rptLib.filterByLabel(issueList.getItems(), config['report-on-label'])
  const issues = new IssueList(issue => issue.html_url)
  issues.add(filtered)

  const ago = moment(now)
  for (let i = 0; i < config['bucket-count']; i++) {
    const daysAgo = i * config['bucket-days']
    ago.subtract(daysAgo, 'days')
    const label = ago.format('MMM Do')

    console.log()
    console.log(`Processing asof ${label} ...`)

    const agoIssues = issues.getItemsAsof(ago.toDate())

    const cycleTime = 0
    let cycleTotal = 0
    let cycleCount = 0
    for (const issue of agoIssues) {
      if (issue.project_stage !== ProjectStages.Done) {
        continue
      }
      ++cycleCount
      const cycleTime = calculateCycleTime(issue)
      console.log(`${cycleTime} days: ${issue.title}`)
      cycleTotal += calculateCycleTime(issue)
    }
    const averageCycleTime = (cycleTotal / cycleCount || 0).toFixed(1)
    console.log(`avg: ${averageCycleTime} (${cycleTotal} / ${cycleCount})`)

    cycleTimeData[label] = <CycleTimeEntry>{
      count: cycleCount,
      averageCycleTime: averageCycleTime,
      flag: averageCycleTime > config['average-limit']
    }
  }

  return cycleTimeData
}

interface CycleTimeRow {
  label: string
  count: number
  average: string
  flag: boolean
}

export function renderMarkdown(targets: CrawlingTarget[], processedData: any): string {
  const cycleTimeData = processedData as CycleTimeData
  const lines: string[] = []
  const rows: CycleTimeRow[] = []
  for (const key in processedData) {
    const entry = processedData[key]
    rows.push(<CycleTimeRow>{label: key, count: entry.count, average: entry.averageCycleTime, flag: entry.flag})
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
  const accepted_time: Date = new Date(card.project_added_at)
  const done_time: Date = new Date(card.project_done_at)

  if (accepted_time == null || done_time == null) {
    return 0
  }

  return moment(done_time).diff(moment(accepted_time), 'days', true)
}
