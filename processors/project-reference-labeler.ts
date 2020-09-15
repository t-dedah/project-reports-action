import moment = require('moment')
import * as url from 'url'
import {GitHubClient} from '../github'
import {CrawlingTarget} from '../interfaces'
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
    'process-with-label': 'feature',
    'column-label-prefix': '> ',
    'linked-label-prefix': '>> ',
    'label-color': 'FFFFFF',
    // need to actually set to true, otherwise it's just a preview of what it would write
    'write-labels': false
  }
}

// const noiseWords = ['the', 'in', 'and', 'of']

function cleanLabelName(prefix: string, title: string) {
  title = title.replace(/\([^()]*\)/g, '').replace(/ *\[[^\]]*]/, '')

  const words = title.match(/[a-zA-Z0-9&]+/g)
  //  words = words.map(item => item.toLowerCase())

  //words = words.filter(word => noiseWords.indexOf(word) < 0)
  return `${prefix.trim()} ${words.join(' ')}`
}

// ensures that only a label with this prefix exists
async function ensureOnlyLabel(
  github: GitHubClient,
  issue: ProjectIssue,
  labelName: string,
  prefix: string,
  config: any
) {
  const write: boolean = config['write-labels']
  if (!write) {
    console.log('Preview mode only')
  }

  const initLabels = issue.labels.filter(label => label.name.trim().toLowerCase() === labelName.trim().toLowerCase())
  if (initLabels.length === 0) {
    // add, but first ...
    // remove any other labels with that prefix
    for (const label of issue.labels) {
      if (label.name.trim().startsWith(prefix)) {
        console.log(`Removing label: ${label.name}`)
        if (write) {
          await github.removeIssueLabel(issue.html_url, label.name)
        }
      }
    }

    console.log(`Adding label: ${labelName}`)
    if (write) {
      await github.ensureIssueHasLabel(issue.html_url, labelName, config['label-color'])
    }
  } else {
    console.log(`Label already exists: ${labelName}`)
  }
}

// get alphanumeric clean version of string (strip special chars). spaces to chars.  remove common filler words (a, the, &, and)
export async function process(
  target: CrawlingTarget,
  config: any,
  data: IssueList,
  github: GitHubClient
): Promise<void> {
  for (const issue of data.getItems()) {
    console.log()
    console.log(`initiative : ${issue.project_column}`)
    console.log(`epic       : ${issue.title}`)

    console.log('creates    :')
    let initLabel
    if (issue.project_column) {
      initLabel = cleanLabelName(config['column-label-prefix'], issue.project_column)
      console.log(`  initiative label : '${initLabel}'`)
    }

    const epicLabel = cleanLabelName(config['linked-label-prefix'], issue.title)
    console.log(`  epic label       : '${epicLabel}'`)

    console.log(issue.body)
    console.log()

    // get issues that have a checkbox in front of it
    const urls = issue.body?.match(/(?<=-\s*\[.*?\].*?)(https?:\/{2}(?:[/-\w.]|(?:%[\da-fA-F]{2}))+)/g)

    for (const match of urls || []) {
      try {
        console.log(`match: ${match}`)
        const u = new url.URL(match)
        const issue = await github.getIssue(match)

        const processLabel = issue.labels.filter(
          label => label.name.toLowerCase() === config['process-with-label'].toLowerCase()
        )

        if (processLabel.length == 0) {
          console.log(`Skipping.  Only processing with label ${config['process-with-label']}`)
          console.log()
          continue
        }

        await ensureOnlyLabel(github, issue, initLabel, config['column-label-prefix'], config)
        await ensureOnlyLabel(github, issue, epicLabel, config['linked-label-prefix'], config)
      } catch (err) {
        console.log(`Ignoring invalid issue url: ${match}`)
        console.log(`(${err.message})`)
      }
      console.log()
    }
  }
}
