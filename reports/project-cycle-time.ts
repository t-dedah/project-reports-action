import moment from 'moment'
import * as os from 'os'
import tablemark from 'tablemark'
import {ProjectData} from '../interfaces'
import * as rptLib from '../project-reports-lib'
import {IssueList, ProjectIssue} from '../project-reports-lib'

const reportType = 'project'
export {reportType}

export type CycleTimeData = {[key: string]: CycleTimeStageData}
interface CycleTimeStageData {
  title: string
  cycletime: number
  limit: number
  count: number
  flag: boolean
}

interface CycleTimeRow {
  labels: string
  count: number
  cycleTimeInDays: string
  limit: string
}

export interface IssueCardCycleTime extends ProjectIssue {
  cycletime: number
}

export function getDefaultConfiguration(): any {
  return <any>{
    'report-on-label': ['feature'],
    'feature-cycletime-limit': 42,
    'epic-cycletime-limit': 42
  }
}

export function process(
  config: any,
  issueList: IssueList,
  drillIn: (identifier: string, title: string, cards: ProjectIssue[]) => void
): any {
  const cycleTimeData = <CycleTimeData>{}
  // merge defaults and overriden config.
  config = Object.assign({}, getDefaultConfiguration(), config)

  const issues = issueList.getItems()
  const projData: rptLib.ProjectStageIssues = rptLib.getProjectStageIssues(
    issues
  )
  for (const cardType of config['report-on-label']) {
    const stageData = <CycleTimeStageData>{}
    const cards = projData['Done']

    const cardsForType = rptLib.filterByLabel(cards, cardType.toLowerCase())
    // add cycle time to each card in this type.
    cardsForType.map((card: IssueCardCycleTime) => {
      card.cycletime = calculateCycleTime(card)
      return card
    })

    stageData.title = cardType
    stageData.count = cardsForType.length
    if (cardsForType.length > 0) {
      // Cycle time is the average of cumulative time divided by number of issues in the `done` column for this label.
      stageData.cycletime =
        cardsForType.reduce((a, b) => a + (b['cycletime'] || 0), 0) /
        cardsForType.length
    } else {
      stageData.cycletime = 0
    }

    const limitKey = `${cardType
      .toLocaleLowerCase()
      .replace(/\s/g, '-')}-cycletime-limit`
    stageData.limit = config[limitKey] || 0
    stageData.flag =
      stageData.limit > -1 && stageData.cycletime > stageData.limit
    cycleTimeData[cardType] = stageData
  }

  return cycleTimeData
}

export function renderMarkdown(
  projData: ProjectData,
  processedData: any
): string {
  const cycleTimeData = processedData as CycleTimeData
  const lines: string[] = []
  const rows: CycleTimeRow[] = []

  lines.push(`## Issue Count & Cycle Time `)
  for (const cardType in cycleTimeData) {
    const stageData = cycleTimeData[cardType]
    const ctRow = <CycleTimeRow>{}
    ctRow.labels = `\`${cardType}\``
    ctRow.count = stageData.count
    ctRow.cycleTimeInDays = ` ${
      stageData.cycletime ? stageData.cycletime.toFixed(2) : ''
    } ${stageData.flag ? ':triangular_flag_on_post:' : ''}`
    ctRow.limit = stageData.limit >= 0 ? stageData.limit.toString() : ''
    rows.push(ctRow)
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
