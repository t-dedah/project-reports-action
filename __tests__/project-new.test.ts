import {IssueList, ProjectIssue} from '../project-reports-lib'
import * as projectNew from '../reports/project-new'
import {NewCards} from '../reports/project-new'
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
    const processed = projectNew.process(config, list, drillIn) as NewCards
    //console.log(JSON.stringify(processed, null, 2));

    expect(processed).toBeDefined()
    expect(processed.cardType).toBe('Epic')
    expect(processed.daysAgo).toBe(1000)

    // expect(processed["Epic"]).toBeDefined();
    expect(processed.cards).toBeDefined()
    expect(processed.cards.length).toBe(5)
  })

  it('renderMarkdown renders valid markdown', async () => {
    const drillIns = []
    const drillIn = (identifier: string, title: string, cards: ProjectIssue[]) => {
      drillIns.push(identifier)
    }

    const list: IssueList = new IssueList(issue => issue.html_url)
    list.add(projectData)
    const processed = projectNew.process(config, list, drillIn) as NewCards
    expect(processed).toBeDefined()

    const markdown = projectNew.renderMarkdown([], processed)
    expect(markdown).toBeDefined()
    expect(markdown).toContain('## :wave: Added Epics')
    expect(markdown).toContain(
      '| <img height="20" width="20" alt="@bryanmacfarlane" src="https://avatars3.githubusercontent.com/u/919564?v=4"/> <a href="https://github.com/bryanmacfarlane">bryanmacfarlane</a> | [Initial Web UI](https://github.com/bryanmacfarlane/quotes-feed/issues/13)'
    )
  })
})
