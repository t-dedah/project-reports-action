import clone from 'clone'
import moment from 'moment'
import * as os from 'os'
import * as url from 'url'

// TODO: separate npm module.  for now it's a file till we flush out

export * from './project-reports-schemes'

export interface RepoProps {
  owner: string
  repo: string
}

export function repoPropsFromUrl(htmlUrl: string): RepoProps {
  const rUrl = new url.URL(htmlUrl)
  const parts = rUrl.pathname.split('/').filter(e => e)

  return <RepoProps>{
    owner: parts[0],
    repo: parts[1]
  }
}

//
// filter cards by label
//
export function filterByLabel(issues: ProjectIssue[], name: string): ProjectIssue[] {
  return issues.filter(
    card => card.labels.findIndex(label => label.name.trim().toLowerCase() === name.toLowerCase()) >= 0
  )
}

//
// Get number from a label by regex.
// e.g. get 2 from label "2-wip", new RegExp("(\\d+)-wip")
// returns NaN if no labels match
//
export function getCountFromLabel(card: ProjectIssue, re: RegExp): number {
  let num = NaN

  for (const label of card.labels) {
    const matches = label.name.match(re)
    if (matches && matches.length > 0) {
      num = parseInt(matches[1])
      if (num) {
        break
      }
    }
  }
  return num
}

export function getStringFromLabel(card: ProjectIssue, re: RegExp): string {
  let str = ''

  for (const label of card.labels) {
    const matches = label.name.trim().match(re)
    if (matches && matches.length > 0) {
      str = matches[0]
      if (str) {
        break
      }
    }
  }

  if (str) {
    str = str.trim()
  }

  return str
}

export function getLastCommentField(issue: ProjectIssue, field: string): string {
  let val = ''

  if (!issue.comments) {
    return ''
  }

  for (let i = issue.comments.length - 1; i >= 0; i--) {
    const comment = issue.comments[i]
    if (!comment) {
      break
    }

    const lines = comment.body.split(os.EOL)
    for (const line of lines) {
      const parts = line.trim().split(':')
      if (parts.length === 2 && fuzzyMatch(parts[0], field)) {
        val = parts[1].trim()
        break
      }
    }

    if (val) {
      break
    }
  }

  return val
}

// returns a valid date field value from a comment field
export function getLastCommentDateField(issue: ProjectIssue, field: string): Date {
  let d: Date = null
  const val = getLastCommentField(issue, field)

  if (val) {
    d = new Date(val)
  }

  return d
}

export function sumCardProperty(cards: ProjectIssue[], prop: string): number {
  return cards.reduce((a, b) => a + (b[prop] || 0), 0)
}

export function fuzzyMatch(content: string, match: string): boolean {
  let matchWords = match.match(/[a-zA-Z0-9]+/g)
  matchWords = matchWords.map(item => item.toLowerCase())

  let contentWords = content.match(/[a-zA-Z0-9]+/g)
  contentWords = contentWords.map(item => item.toLowerCase())

  let isMatch = true
  for (const matchWord of matchWords) {
    if (contentWords.indexOf(matchWord) === -1) {
      isMatch = false
      break
    }
  }
  return isMatch
}

export function extractUrlsFromChecklist(body: string): string[] {
  return body?.match(/(?<=-\s*\[.*?\].*?)(https?:\/{2}(?:[/-\w.]|(?:%[\da-fA-F]{2}))+)/g) || []
}

// Project issues keyed by the stage they are in
export interface ProjectIssues {
  stages: {[key: string]: ProjectIssue[]}
}

export interface ProjectColumn {
  cards_url: string
  id: number
  name: string
}

// stages more discoverable
export const ProjectStages = {
  Proposed: 'Proposed',
  Accepted: 'Accepted',
  InProgress: 'In-Progress',
  Done: 'Done',
  Missing: 'Missing'
}

export type ProjectStageIssues = {[key: string]: ProjectIssue[]}

export function getProjectStageIssues(issues: ProjectIssue[]) {
  const projIssues = <ProjectStageIssues>{}
  for (const projIssue of issues) {
    const stage = projIssue['project_stage']
    if (!stage) {
      // the engine will handle and add to an issues list
      continue
    }

    if (!projIssues[stage]) {
      projIssues[stage] = []
    }

    projIssues[stage].push(projIssue)
  }

  return projIssues
}

export interface IssueLabel {
  name: string
  color: string
}

export interface IssueCardEventProject {
  project_id: number
  column_name: string
  previous_column_name: string
  stage_name: string
  previous_stage_name: string
}

export interface IssueEvent {
  created_at: Date
  event: string
  assignee: IssueUser
  label: IssueLabel
  project_card: IssueCardEventProject
  //data: any
}

export interface IssueUser {
  login: string
  id: number
  avatar_url: string
  url: string
  html_url: string
}

export interface IssueMilestone {
  title: string
  description: string
  due_on: Date
}

export interface IssueComment {
  body: string
  user: IssueUser
  created_at: Date
  updated_at: Date
}

export interface ProjectIssue {
  title: string
  body: string
  number: number
  html_url: string
  state: string
  labels: IssueLabel[]
  assignee: IssueUser
  assignees: IssueUser[]
  user: IssueUser
  milestone: IssueMilestone
  closed_at: Date
  created_at: Date
  updated_at: Date

  comments: IssueComment[]
  events: IssueEvent[]

  //
  // project stage fields we decorate on issues
  //

  // first added to the board on any column (no "from" column)
  project_added_at: Date

  // last occurence of moving to these columns from a lesser or no column
  // example. if moved to accepted from proposed (or less),
  //      then in-progress (greater) and then back to accepted, first wins
  project_proposed_at: Date
  project_accepted_at: Date
  project_in_progress_at: Date

  // cleared if not currently blocked
  project_blocked_at: Date

  // cleared if it moves out of done.  e.g. current state has to be done for this to be set
  project_done_at: Date

  // current stage of this card on the board
  project_stage: string

  // current column of this card on the board
  project_column: string
}

const stageLevel = {
  None: 0,
  Proposed: 1,
  Accepted: 2,
  'In-Progress': 3,
  Done: 4,
  Unmapped: 5
}

export class IssueList {
  private seen
  private identifier
  private items: ProjectIssue[]
  private processed: ProjectIssue[]

  // keep in order indexed by level above
  // TODO: unify both to avoid out of sync problems
  stageAtNames = ['none', 'project_proposed_at', 'project_accepted_at', 'project_in_progress_at', 'project_done_at']

  constructor(identifier: (item) => any) {
    this.seen = new Map()
    this.identifier = identifier
    this.items = []
  }

  // returns whether any were added
  public add(data: any | any[]): boolean {
    this.processed = null
    let added = false
    if (Array.isArray(data)) {
      for (const item of data) {
        const res = this.add_item(item)
        if (!added) {
          added = res
        }
      }
    } else {
      return this.add_item(data)
    }

    return added
  }

  private add_item(item: any): boolean {
    const id = this.identifier(item)

    if (!this.seen.has(id)) {
      this.items.push(item)
      this.seen.set(id, item)
      return true
    }

    return false
  }

  public getItem(identifier: any): ProjectIssue {
    return this.seen.get(identifier)
  }

  public getItems(): ProjectIssue[] {
    if (this.processed) {
      return this.processed
    }

    // call process
    for (const item of this.items) {
      this.processStages(item)
    }

    this.processed = this.items
    return this.processed
  }

  public getItemsAsof(datetime: Date): ProjectIssue[] {
    const issues: ProjectIssue[] = []

    for (const item of this.items) {
      const id = this.identifier(item)
      issues.push(this.getItemAsof(id, datetime))
    }

    return issues
  }
  //
  // Gets an issue from a number of days, hours ago.
  // Clones the issue and Replays events (labels, column moves, milestones)
  // and reprocesses the stages.
  // If the issue doesn't exist in the list, returns null
  //
  public getItemAsof(identifier: any, datetime: string | Date): ProjectIssue {
    console.log(`getting asof ${datetime} : ${identifier}`)
    let issue = this.getItem(identifier)

    if (!issue) {
      return issue
    }

    issue = clone(issue)
    const momentAgo = moment(datetime)

    // clear everything we're going to re-apply
    issue.labels = []
    delete issue.project_column
    delete issue.project_added_at
    delete issue.project_proposed_at
    delete issue.project_in_progress_at
    delete issue.project_accepted_at
    delete issue.project_done_at
    delete issue.project_stage
    delete issue.closed_at

    // stages and labels
    const filteredEvents: IssueEvent[] = []
    const labelMap: {[name: string]: IssueLabel} = {}

    if (issue.events) {
      for (const event of issue.events) {
        if (moment(event.created_at).isAfter(momentAgo)) {
          continue
        }

        filteredEvents.push(event)

        if (event.event === 'labeled') {
          labelMap[event.label.name] = event.label
        } else if (event.event === 'unlabeled') {
          delete labelMap[event.label.name]
        }

        if (event.event === 'closed') {
          issue.closed_at = event.created_at
        }

        if (event.event === 'reopened') {
          delete issue.closed_at
        }
      }
    }
    issue.events = filteredEvents

    for (const labelName in labelMap) {
      issue.labels.push(labelMap[labelName])
    }

    this.processStages(issue)

    // comments
    const filteredComments: IssueComment[] = []
    for (const comment of issue.comments) {
      if (moment(comment.created_at).isAfter(momentAgo)) {
        continue
      }

      filteredComments.push(comment)
    }
    issue.comments = filteredComments

    return issue
  }

  //
  // Process the events to set project specific fields like project_done_at, project_in_progress_at, etc
  // Call initially and then call again if events are filtered (get issue asof)
  //
  private processStages(issue: ProjectIssue): void {
    console.log()
    console.log(`Processing stages for ${issue.html_url}`)
    // card events should be in order chronologically
    let currentStage: string
    let currentColumn: string
    let doneTime: Date
    let addedTime: Date

    const tempLabels = {}

    if (issue.events) {
      for (const event of issue.events) {
        let eventDateTime: Date
        if (event.created_at) {
          eventDateTime = event.created_at
        }

        //
        // Process Project Stages
        //
        let toStage: string
        let toLevel: number
        let fromStage: string
        let fromLevel = 0

        if (event.project_card && event.project_card.column_name) {
          if (!addedTime) {
            addedTime = eventDateTime
          }

          if (issue.project_stage !== 'None' && !event.project_card.stage_name) {
            throw new Error(`stage_name should have been set already for ${event.project_card.column_name}`)
          }

          toStage = event.project_card.stage_name
          toLevel = stageLevel[toStage]
          currentStage = toStage
          currentColumn = event.project_card.column_name
        }

        if (issue.project_stage !== 'None' && event.project_card && event.project_card.previous_column_name) {
          if (!event.project_card.previous_stage_name) {
            throw new Error(
              `previous_stage_name should have been set already for ${event.project_card.previous_column_name}`
            )
          }

          fromStage = event.project_card.previous_stage_name
          fromLevel = stageLevel[fromStage]
        }

        // last occurence of moving to these columns from a lesser or no column
        // example. if moved to accepted from proposed (or less),
        //      then in-progress (greater) and then back to accepted, first wins
        if (toStage === 'Proposed' || toStage === 'Accepted' || toStage === 'In-Progress') {
          if (toLevel > fromLevel) {
            issue[this.stageAtNames[toLevel]] = eventDateTime
          }
          //moving back, clear the stage at dates up to fromLevel
          else if (toLevel < fromLevel) {
            for (let i = toLevel + 1; i <= fromLevel; i++) {
              delete issue[this.stageAtNames[i]]
            }
          }
        }

        if (toStage === 'Done') {
          doneTime = eventDateTime
        }
      }

      // done_at and blocked_at is only set if it's currently at that stage
      if (currentStage === 'Done') {
        issue.project_done_at = doneTime
        console.log(`project_done_at: ${issue.project_done_at}`)
      }

      if (addedTime) {
        issue.project_added_at = addedTime
        console.log(`project_added_at: ${issue.project_added_at}`)
      }

      // current board processing does by column so we already know these
      // asof replays events and it's possible to have the same time and therefore can be out of order.
      // only take that fragility during narrow asof cases.
      // asof clears these
      if (!issue.project_column) {
        issue.project_column = currentColumn
      }

      if (!issue.project_stage) {
        issue.project_stage = currentStage
      }

      console.log(`project_stage: ${issue.project_stage}`)
      console.log(`project_column: ${issue.project_column}`)
    }
  }
}
