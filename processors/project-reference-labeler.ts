import moment = require('moment')
import {CrawlingTarget} from '../interfaces'
import {IssueList} from '../project-reports-lib'

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
    'linked-label-prefix': '>> '
  }
}

const noiseWords = ['the', 'in', 'and', 'of']

function cleanLabelName(prefix: string, title: string) {
  title = title.replace(/\([^()]*\)/g, '').replace(/ *\[[^\]]*]/, '')

  let words = title.match(/[a-zA-Z0-9]+/g)
  //  words = words.map(item => item.toLowerCase())

  words = words.filter(word => noiseWords.indexOf(word) < 0)
  return `${prefix.trim()} ${words.join(' ')}`
}

// get alphanumeric clean version of string (strip special chars). spaces to chars.  remove common filler words (a, the, &, and)
export function process(target: CrawlingTarget, config: any, data: IssueList): void {
  for (const issue of data.getItems()) {
    console.log()
    console.log(`initiative : ${issue.project_column}`)
    console.log(`epic       : ${issue.title}`)

    console.log('creates    :')
    if (issue.project_column) {
      const initLabel = cleanLabelName(config['column-label-prefix'], issue.project_column)
      console.log(`  initiative label : '${initLabel}'`)
    }

    const epicLabel = cleanLabelName(config['linked-label-prefix'], issue.title)
    console.log(`  epic label       : '${epicLabel}'`)
  }
}

//
