import {GitHubClient} from '../github'
import {CrawlingTarget} from '../interfaces'
import {getLastCommentField, IssueList, ProjectIssue} from '../project-reports-lib'

const reportType = 'project'
export {reportType}

export type ProjectStatusLabelerConfig = {
  'process-with-label': string
  'status-field-name': string
  'status-labels': string[]
  'status-colors': string[]
  'write-labels': boolean
}

/**
 * Reads the latest status from a comment and creates the corresponding label
 */
export function getDefaultConfiguration(): ProjectStatusLabelerConfig {
  return {
    'process-with-label': 'feature',
    'status-field-name': '### Status',

    // names and corresponding colors should align
    'status-labels': ['green', 'yellow', 'red'],
    'status-colors': ['22a524', 'fbca04', 'b60205'],

    // need to actually set to true, otherwise it's just a preview of what it would write
    'write-labels': false
  }
}

// ensures that only a label with this prefix exists
async function ensureOnlyLabel(github: GitHubClient, issue: ProjectIssue, labelName: string, config: any) {
  const write: boolean = config['write-labels']
  if (!write) {
    console.log('Preview mode only')
  }

  const currentLabels: string[] = issue.labels.map(label => label.name.toLowerCase())

  // add, but first ...
  // remove any other status labels not the desired one
  for (const candidate of config['status-labels']) {
    // if the candidate label is currently set
    // but it's not the desired label, remove it
    if (currentLabels.indexOf(candidate.toLowerCase()) >= 0 && candidate.toLowerCase() !== labelName.toLowerCase()) {
      console.log(`Removing label: ${candidate}`)
      if (write) {
        await github.removeIssueLabel(issue.html_url, candidate)
      }
    }
  }

  if (currentLabels.indexOf(labelName.toLowerCase()) >= 0) {
    console.log(`Label '${labelName}' already exists on issue`)
  } else {
    const candidates = config['status-labels'].map(label => label.toLowerCase())
    const index = candidates.indexOf(labelName.toLowerCase())
    let color = 'FFFFFF'
    if (index < config['status-colors'].length) {
      color = config['status-colors'][index]
    }

    console.log(`Adding label: ${labelName} with color ${color}`)
    if (write) {
      await github.ensureIssueHasLabel(issue.html_url, labelName, color)
    }
  }
}

// get alphanumeric clean version of string (strip special chars). spaces to chars.  remove common filler words (a, the, &, and)
export async function process(
  target: CrawlingTarget,
  config: ProjectStatusLabelerConfig,
  data: IssueList,
  github: GitHubClient
): Promise<void> {
  console.log()
  console.log('Processing status labels')
  console.log()
  for (const issue of data.getItems()) {
    console.log(`issue : ${issue.title}`)
    console.log(`url   : ${issue.html_url}`)

    const processLabel = issue.labels.filter(
      label => label.name.toLowerCase() === config['process-with-label'].toLowerCase()
    )

    if (processLabel.length == 0) {
      console.log(`Skipping.  Only processing with label ${config['process-with-label']}`)
      console.log()
      continue
    }

    const status = getLastCommentField(issue, config['status-field-name'])
    if (!status) {
      console.log('No status.  Skipping.')
      console.log()
      continue
    }

    console.log(`Latest status: ${status}`)

    const validLabelsLower: string[] = config['status-labels'].map(label => label.toLowerCase())
    const idx = validLabelsLower.indexOf(status.toLowerCase())
    if (status && idx >= 0) {
      await ensureOnlyLabel(github, issue, config['status-labels'][idx], config)
    } else {
      console.log(`skipping. ${status} is not a valid status label `)
    }

    console.log()
  }
}
