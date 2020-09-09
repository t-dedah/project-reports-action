import {IssueList, ProjectIssue} from '../project-reports-lib'
import * as limits from '../reports/project-limits'
import {LimitsData} from '../reports/project-limits'
import projectData from './project-data.test.json'

const config: any = {
  'report-on-label': 'Epic',
  'proposed-limit': 2,
  'accepted-limit': 2,
  'in-progress-limit': 2,
  'done-limit': 100,
  'count-label-match': '(\\d+)-dev'
}

describe('report-lib', () => {
  // make sure the mocked data set is loaded and valid
  it('imports a valid projectData from file', async () => {
    expect(projectData).toBeDefined()
    expect(projectData.length).toBe(14)
  })

  it('process returns WipData', async () => {
    const drillIns = []
    const drillIn = (identifier: string, title: string, cards: ProjectIssue[]) => {
      drillIns.push(identifier)
    }

    const list: IssueList = new IssueList(issue => issue.html_url)
    list.add(projectData)
    const processed = limits.process(config, list, drillIn) as LimitsData
    //console.log(JSON.stringify(processed, null, 2));

    const data = processed.data
    expect(processed).toBeDefined()
    expect(data).toBeDefined()
    // expect(processed["Epic"]).toBeDefined();
    expect(data['Proposed']).toBeDefined()
    expect(data['Proposed'].items.length).toBe(0)
    expect(data['Proposed'].limit).toBe(2)
    expect(data['Proposed'].flag).toBe(false)
    expect(data['In-Progress']).toBeDefined()
    expect(data['In-Progress'].items.length).toBe(4)
    expect(data['In-Progress'].limit).toBe(2)
    expect(data['In-Progress'].flag).toBe(true)
    expect(data['Accepted']).toBeDefined()
    expect(data['Done']).toBeDefined()
  })

  it('renderMarkdown renders valid markdown', async () => {
    const drillIns = []
    const drillIn = (identifier: string, title: string, cards: ProjectIssue[]) => {
      drillIns.push(identifier)
    }

    const list: IssueList = new IssueList(issue => issue.html_url)
    list.add(projectData)
    const processed = limits.process(config, list, drillIn) as LimitsData
    expect(processed).toBeDefined()
    expect(drillIns.length).toBe(4)

    const markdown = limits.renderMarkdown([], processed)
    expect(markdown).toBeDefined()
    expect(markdown).toContain('## :ship: Epic Limits')
    expect(markdown).toContain('| In-Progress | [4](./limits-Epic-In-Progress.md)  :triangular_flag_on_post: | 2     |')
  })
})
