import {IssueList, ProjectIssue} from '../project-reports-lib'
import * as projectDone from '../reports/project-done'
import {CompletedCards} from '../reports/project-done'
import projectData from './project-data.test.json'

const config: any = {
  'report-on': 'Epic',
  daysAgo: 1000
}

describe('project-new', () => {
  // make sure the mocked data set is loaded and valid
  it('imports a valid projectData from file', async () => {
    expect(projectData).toBeDefined()
    expect(projectData.length).toBe(14)
  })

  it('process returns NewCards', async () => {
    const drillIns = []
    const drillIn = (identifier: string, title: string, cards: ProjectIssue[]) => {
      drillIns.push(identifier)
    }

    const list: IssueList = new IssueList(issue => issue.html_url)
    list.add(projectData)
    const processed = projectDone.process(config, list, drillIn) as CompletedCards
    //console.log(JSON.stringify(processed, null, 2));

    expect(processed).toBeDefined()
    expect(processed.cardType).toBe('Epic')
    expect(processed.daysAgo).toBe(1000)

    expect(processed.cards).toBeDefined()
    expect(processed.cards.length).toBe(1)
  })

  it('renderMarkdown renders valid markdown', async () => {
    const drillIns = []
    const drillIn = (identifier: string, title: string, cards: ProjectIssue[]) => {
      drillIns.push(identifier)
    }

    const list: IssueList = new IssueList(issue => issue.html_url)
    list.add(projectData)
    const processed = projectDone.process(config, list, drillIn) as CompletedCards
    expect(processed).toBeDefined()

    const markdown = projectDone.renderMarkdown([], processed)
    expect(markdown).toBeDefined()
    expect(markdown).toContain('## :checkered_flag: Completed Epics')
    expect(markdown).toContain(
      '| <img height="20" width="20" alt="@bryanmacfarlane" src="https://avatars3.githubusercontent.com/u/919564?v=4"/> <a href="https://github.com/bryanmacfarlane">bryanmacfarlane</a> | [feed front project scaffolding](https://github.com/bryanmacfarlane/quotes-feed/issues/6) |'
    )
  })
})
