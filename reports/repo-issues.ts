import clone from 'clone'
import * as os from 'os'
import tablemark from 'tablemark'
import {CrawlingTarget} from '../interfaces'
import * as rptLib from '../project-reports-lib'
import {IssueList, ProjectIssue} from '../project-reports-lib'

const reportType = 'repo'
export {reportType}

/*
 * Gives visibility into whether the team has untriaged debt, an approval bottleneck and
 * how focused the team is (e.g. how many efforts are going on)
 * A wip is a work in progress unit of resourcing.  e.g. it may be one developer or it might mean 4 developers.
 */
export function getDefaultConfiguration(): any {
  return <any>{
    'breakdown-by-labels': ['bug', 'security', 'documentation']
  }
}

export interface IssueLabelBreakdown {
  identifier: number
  repositories: string[]
  issues: {[label: string]: ProjectIssue[]}
}

function getDrillName(label: string, identifier: number): string {
  return `issues-${label}-${identifier}`.split(' ').join('-')
}

export function process(
  config: any,
  issueList: IssueList,
  drillIn: (identifier: string, title: string, issues: ProjectIssue[]) => void
): any {
  console.log('Processing issues')

  const breakdown = <IssueLabelBreakdown>{}
  breakdown.identifier = new Date().getTime() / 1000
  breakdown.issues = {}

  const issues = issueList.getItems()

  breakdown.repositories = [
    ...new Set(
      issues.map(issue => {
        const nwoRegex = /^https:\/\/github.com\/(.+)\/(.+)\/.+$/
        const match = issue.html_url.match(nwoRegex)
        return [match[1], match[2]].join('/')
      })
    )
  ]

  for (const label of config['breakdown-by-labels']) {
    const slice = rptLib.filterByLabel(issues, label)
    breakdown.issues[label] = clone(slice)
    drillIn(getDrillName(label, breakdown.identifier), `Issues for ${label}`, slice)
  }

  return breakdown
}

interface BreakdownRow {
  label: string
  count: string
}

export function renderMarkdown(targets: CrawlingTarget[], processedData: any): string {
  const breakdown = processedData as IssueLabelBreakdown

  const lines: string[] = []

  let linksHeading = ''
  for (const target of targets) {
    const props = rptLib.repoPropsFromUrl(target.htmlUrl)
    linksHeading += `[${props.repo}](${target.htmlUrl}), `
  }
  // chop final delimiter
  linksHeading = linksHeading.substr(0, linksHeading.length - 2)

  lines.push(`## Issues for ${linksHeading}`)

  // create a report for each type.  e.g. "Epic"
  // let typeLabel = wipData.cardType === '*'? "": wipData.cardType;
  // lines.push(`## :ship: ${typeLabel} Limits  `);

  const rows: BreakdownRow[] = []
  for (const label in breakdown.issues) {
    const row = <BreakdownRow>{}
    row.label = `\`${label}\``
    // data folder is part of the contract here.  make a lib function to create this path
    row.count = `[${breakdown.issues[label].length}](./${getDrillName(label, breakdown.identifier)}.md)`
    rows.push(row)
  }

  const table: string = tablemark(rows)
  lines.push(table)

  return lines.join(os.EOL)
}

export function renderHtml(): string {
  // Not supported yet
  return ''
}
