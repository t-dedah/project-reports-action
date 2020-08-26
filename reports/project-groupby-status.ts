import clone from 'clone'
import * as os from 'os'
import tablemark from 'tablemark'
import {CrawlingTarget} from '../interfaces'
import * as rptLib from '../project-reports-lib'
import {
  IssueList,
  ProjectIssue,
  ProjectStageIssues,
  ProjectStages
} from '../project-reports-lib'
import moment = require('moment')

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
    'report-on-label': 'feature',
    'group-by-label-prefix': '> ',
    'target-date-comment-field': 'target date',
    'flag-in-progress-days': 21,
    'wip-limit': 2,
    'status-label-match': '(?:green|yellow|red)'
  }
}

export interface GroupBy {
  total: GroupByData
  groups: {[group: string]: GroupByData}
  durationDays: number
  wipLimit: number
}

export type GroupByData = {
  stages: StageBreakdown
  flagged: Flagged
}

export interface StageBreakdown {
  proposed: ProjectIssue[]
  accepted: ProjectIssue[]
  inProgress: ProjectIssue[]
  done: ProjectIssue[]
}

export interface Flagged {
  inProgressDuration: ProjectIssue[]
  pastTarget: ProjectIssue[]
  noTarget: ProjectIssue[]
  red: ProjectIssue[]
  yellow: ProjectIssue[]
}

function drillInName(name: string, column: string) {
  return `${name}-${column}`
}

function getBreakdown(
  config: any,
  name: string,
  issues: ProjectIssue[],
  drillIn: (identifier: string, title: string, cards: ProjectIssue[]) => void
): GroupByData {
  const groupByData: GroupByData = <GroupByData>{}

  const stageData: ProjectStageIssues = rptLib.getProjectStageIssues(issues)

  groupByData.stages = <StageBreakdown>{}
  groupByData.stages.proposed = stageData[ProjectStages.Proposed] || []
  drillIn(
    drillInName(name, 'proposed'),
    `${name} proposed`,
    groupByData.stages.proposed
  )

  groupByData.stages.accepted = stageData[ProjectStages.Accepted] || []
  drillIn(
    drillInName(name, 'accepted'),
    `${name} accepted`,
    groupByData.stages.accepted
  )

  groupByData.stages.inProgress = stageData[ProjectStages.InProgress] || []
  drillIn(
    drillInName(name, 'in-progress'),
    `${name} in progress`,
    groupByData.stages.inProgress
  )

  groupByData.stages.done = stageData[ProjectStages.Done] || []
  drillIn(drillInName(name, 'done'), `${name} done`, groupByData.stages.done)

  groupByData.flagged = <Flagged>{}
  const exceeded = issues.filter(
    issue =>
      issue.project_in_progress_at &&
      moment().diff(moment(issue.project_in_progress_at), 'days') >
        config['flag-in-progress-days']
  )

  const statusRegEx = new RegExp(config['status-label-match'])
  groupByData.flagged.red =
    issues.filter(
      issue =>
        rptLib.getStringFromLabel(issue, statusRegEx).toLowerCase() === 'red'
    ) || []
  drillIn(
    drillInName(name, 'red'),
    `${name} with a status red`,
    groupByData.flagged.red
  )

  groupByData.flagged.yellow =
    issues.filter(
      issue =>
        rptLib.getStringFromLabel(issue, statusRegEx).toLowerCase() === 'yellow'
    ) || []
  drillIn(
    drillInName(name, 'yellow'),
    `${name} with a status yellow`,
    groupByData.flagged.yellow
  )

  groupByData.flagged.inProgressDuration = exceeded
  drillIn(
    drillInName(name, 'duration'),
    `${name} > ${config['flag-in-progress-days']} in progress duration`,
    groupByData.flagged.inProgressDuration
  )

  groupByData.flagged.noTarget = issues.filter(issue => {
    const d = rptLib.getLastCommentDateField(
      issue,
      config['target-date-comment-field']
    )
    return !d || isNaN(d.valueOf())
  })
  drillIn(
    drillInName(name, 'no-target'),
    `${name} with no target date`,
    groupByData.flagged.noTarget
  )

  groupByData.flagged.pastTarget = issues.filter(issue => {
    const d = rptLib.getLastCommentDateField(
      issue,
      config['target-date-comment-field']
    )
    return d && !isNaN(d.valueOf()) && moment(d).isAfter(now)
  })
  drillIn(
    drillInName(name, 'past-target'),
    `${name} past the target date`,
    groupByData.flagged.pastTarget
  )

  return groupByData
}

export function process(
  config: any,
  issueList: IssueList,
  drillIn: (identifier: string, title: string, cards: ProjectIssue[]) => void
): any {
  console.log('> project-group-by::process')

  const groupData = <GroupBy>{}
  groupData.durationDays = config['flag-in-progress-days']
  groupData.wipLimit = config['wip-limit']
  groupData.groups = {}

  const issues = issueList.getItems()

  const label = config['report-on-label']
  if (!label) {
    throw new Error('report-on-label is required')
  }
  console.log(`Getting issues for ${label}`)
  const issuesForLabel =
    label === '*'
      ? clone(issues)
      : clone(
          rptLib.filterByLabel(
            issues,
            label.trim().toLowerCase()
          ) as ProjectIssue[]
        )

  // get distinct group by labels
  const prefix = config['group-by-label-prefix']
  if (!prefix) {
    throw new Error('group-by-label-prefix is required')
  }

  const pattern = `(?<=${prefix}).*`
  const regex = new RegExp(pattern)
  const groupByLabels: string[] = []
  for (const issue of issuesForLabel) {
    const labelValue = (rptLib.getStringFromLabel(issue, regex) || '').trim()
    if (labelValue && groupByLabels.indexOf(labelValue) === -1) {
      groupByLabels.push(labelValue)
    }
  }

  console.log(`labels: ${JSON.stringify(groupByLabels)}`)
  groupData.total = getBreakdown(config, 'Total', issuesForLabel, drillIn)
  for (const group of groupByLabels) {
    const issuesForGroup = rptLib.filterByLabel(
      issuesForLabel,
      `${prefix}${group}`
    )
    console.log(`${group} ${issuesForGroup.length}`)
    groupData.groups[group] = getBreakdown(
      config,
      group,
      issuesForGroup,
      drillIn
    )
  }

  console.log(JSON.stringify(groupData, null, 2))
  return groupData
}

interface BreakdownRow {
  name: string
  proposed: string
  accepted: string
  inProgress: string
  done: string
  spacer: string
  inProgressDuration: string
  pastTarget: string
  noTarget: string
  red: string
  yellow: string
}

function getFlagContents(count: number, limit: number) {
  return count <= limit ? '' : `${count} :triangular_flag_on_post:`
}

function getLimitContents(count: number, limit: number) {
  return `${count} ${count > limit ? ':triangular_flag_on_post:' : ''}`
}

function getRow(
  name: string,
  days: number,
  wips: number,
  data: GroupByData,
  lines: string[]
): BreakdownRow {
  const breakdownRow = <BreakdownRow>{}
  breakdownRow.name = `**${name}**`

  breakdownRow.proposed = `[${data.stages.proposed.length}](./${drillInName(
    name,
    'proposed'
  )}.md)`
  breakdownRow.accepted = `[${data.stages.accepted.length}](./${drillInName(
    name,
    'accepted'
  )}.md)`
  breakdownRow.inProgress = `[${getLimitContents(
    data.stages.inProgress.length,
    wips
  )}](./${drillInName(name, 'in-progress')}.md)`
  breakdownRow.done = `[${data.stages.done.length.toString()}](./${drillInName(
    name,
    'done'
  )}.md)`
  breakdownRow.spacer = ''
  breakdownRow.yellow = `[${getFlagContents(
    data.flagged.yellow.length,
    0
  )}](./${drillInName(name, 'yellow')}.md)`
  breakdownRow.red = `[${getFlagContents(
    data.flagged.red.length,
    0
  )}](./${drillInName(name, 'red')}.md)`
  breakdownRow.inProgressDuration = `[${getFlagContents(
    data.flagged.inProgressDuration.length,
    0
  )}](./${drillInName(name, 'duration')}.md)`
  breakdownRow.noTarget = `[${getFlagContents(
    data.flagged.noTarget.length,
    0
  )}](./${drillInName(name, 'no-target')}.md)`
  breakdownRow.pastTarget = `[${getFlagContents(
    data.flagged.pastTarget.length,
    0
  )}](./${drillInName(name, 'past-target')}.md)`

  return breakdownRow
}

export function renderMarkdown(
  targets: CrawlingTarget[],
  processedData: any
): string {
  console.log('> project-groupby-status::renderMarkdown')

  const lines: string[] = []
  lines.push('## :rocket: Execution  ')
  const groupBy = processedData as GroupBy

  const rows: BreakdownRow[] = []
  rows.push(
    getRow(
      'Total',
      groupBy.durationDays,
      groupBy.wipLimit,
      groupBy.total,
      lines
    )
  )
  lines.push('&nbsp;  ')
  for (const group in groupBy.groups) {
    rows.push(
      getRow(
        group,
        groupBy.durationDays,
        groupBy.wipLimit,
        groupBy.groups[group],
        lines
      )
    )
  }

  lines.push(
    tablemark(rows, {
      columns: [
        '...',
        {name: ':new:', align: 'center'},
        {name: ':white_check_mark:', align: 'center'},
        {
          name: `:hourglass_flowing_sand: <sub><sup>(${groupBy.wipLimit})</sup></sub>`,
          align: 'center'
        },
        {name: ':checkered_flag:', align: 'center'},
        '...',
        {name: ':yellow_heart:', align: 'center'},
        {name: ':heart:', align: 'center'},
        {
          name: `:calendar: <sub><sup>(>${groupBy.durationDays} days)</sup></sub>`,
          align: 'center'
        },
        {
          name: ':man_shrugging: <sub><sup>Target Date</sup></sub>',
          align: 'center'
        },
        {
          name: ':alarm_clock: <sub><sup>Target Date</sup></sub>',
          align: 'center'
        }
      ]
    })
  )
  lines.push(
    '<sub><sup>:new: Proposed => :white_check_mark: Accepted => :hourglass_flowing_sand: In-Progress => :checkered_flag: Done</sup></sub>'
  )
  lines.push('&nbsp;  ')

  return lines.join(os.EOL)
}

export function renderHtml(): string {
  // Not supported yet
  return ''
}
