import {Octokit} from '@octokit/rest'
import * as url from 'url'
import {ProjectData} from '../interfaces'
import {IssueComment, IssueList, ProjectColumn, ProjectIssue} from '../project-reports-lib'
import * as restCache from './octokit-rest-cache'

function DateOrNull(date: string): Date {
  return date ? new Date(date) : null
}

export class GitHubClient {
  octokit: any

  constructor(token: string, cacheDir) {
    this.octokit = new Octokit({
      auth: token,
      previews: [
        'squirrel-girl-preview',
        'inertia-preview',
        'starfox-preview',
        'mockingbird-preview',
        'sailor-v-preview'
      ]
    })

    const diskCache = new restCache.FileSystemStore(cacheDir)
    this.octokit.hook.wrap('request', restCache.wrap(diskCache))
  }

  public async getProject(projectHtmlUrl: string): Promise<ProjectData> {
    console.log(`Finding project for ${projectHtmlUrl}`)

    let proj: ProjectData = null
    const projUrl = new url.URL(projectHtmlUrl)
    const projParts = projUrl.pathname.split('/').filter(e => e)

    if (projParts.length !== 4) {
      throw new Error(`Invalid project url: ${projectHtmlUrl}`)
    }

    const projKind = projParts[0] // orgs or users
    const projOwner = projParts[1] // orgname or username
    // let projId = projParts[3];    // html id

    let count = 0
    let page = 0
    do {
      ++page
      console.log(`page: ${page}`)

      let res

      if (projKind === 'orgs') {
        console.log(`querying: ${projKind}, ${projOwner}`)
        res = await this.octokit.projects.listForOrg({
          org: projOwner,
          state: 'open',
          per_page: 100,
          page: page
        })
      } else if (projKind === 'users') {
        console.log(`querying: ${projKind}, ${projOwner}`)
        res = await this.octokit.projects.listForUser({
          username: projOwner,
          state: 'open',
          per_page: 100,
          page: page
        })
      } else {
        // if it's not an org or user project, must be a repo
        const owner = projParts[0]
        const repo = projParts[1]
        console.log(`querying for owner:'${owner}', repo:'${repo}'`)
        res = await this.octokit.projects.listForRepo({
          owner: owner,
          repo: repo,
          state: 'open',
          per_page: 100,
          page: page
        })
      }

      const projects = res.data
      count = projects.length

      for (const project of projects) {
        if (projectHtmlUrl.indexOf(project.html_url) > -1) {
          proj = <ProjectData>{
            id: project.id,
            html_url: project.html_url,
            name: project.name
          }

          console.log(`Found ${project.name}`)
          break
        }
      }
    } while (count == 100)

    return proj
  }

  public async getColumnsForProject(project): Promise<ProjectColumn[]> {
    const cols = await this.octokit.projects.listColumns({
      project_id: project.id
    })
    return cols.data
  }

  public async getCardsForColumns(colId: number) {
    const cards = await this.octokit.projects.listCards({column_id: colId})
    return cards.data
  }

  public async getIssueComments(owner: string, repo: string, issue_number: string): Promise<IssueComment[]> {
    return await this.octokit.paginate('GET /repos/:owner/:repo/issues/:id/comments', {
      owner: owner,
      repo: repo,
      id: issue_number,
      per_page: 100
    })
  }

  private issueParts(issueUrl) {
    const issURL = new url.URL(issueUrl)

    // apiUrl: https://api.github.com/repos/bryanmacfarlane/quotes-feed/issues/9
    // htmlUrl: https://github.com/bryanmacfarlane/quotes-feed/issues/9
    const apiUrl = issURL.host.startsWith('api.')

    const parts = issURL.pathname.split('/').filter(e => e)
    const owner = parts[apiUrl ? 1 : 0]
    const repo = parts[apiUrl ? 2 : 1]
    const issue_number = parts[apiUrl ? 4 : 3]

    return {
      owner,
      repo,
      issue_number
    }
  }

  public async ensureLabel(owner: string, repo: string, name: string, color: string): Promise<void> {
    console.log(`ensure label ${owner} ${repo} ${name} ${color}`)

    try {
      const res = await this.octokit.issues.getLabel({
        owner,
        repo,
        name
      })

      console.log(`${name} exists`)
      return
    } catch {
      console.log(`Creating label ${name} ${color}`)
    }

    // create
    const res = await this.octokit.issues.createLabel({
      owner,
      repo,
      name,
      color
    })
    console.log('created')
  }

  public async ensureIssueHasLabel(issueUrl: string, name: string, color: string): Promise<void> {
    const issueParts = this.issueParts(issueUrl)
    await this.ensureLabel(issueParts.owner, issueParts.repo, name, color)

    const labels = [name]
    const res = await this.octokit.issues.addLabels({
      ...issueParts,
      labels
    })
    console.log('added')
  }

  public async removeIssueLabel(issueUrl: string, name: string) {
    await this.octokit.issues.removeLabel({
      ...this.issueParts(issueUrl),
      name
    })
    console.log(`removed ${name}`)
  }

  // returns null if not an issue
  public async getIssueForCard(card: any): Promise<ProjectIssue> {
    if (!card.content_url) {
      return null
    }

    return this.getIssue(card.content_url)
  }

  public async getIssue(issueUrl: string): Promise<ProjectIssue> {
    const issueParts = this.issueParts(issueUrl)

    const issueCard = <ProjectIssue>{}

    const res = await this.octokit.issues.get({
      ...issueParts,
      per_page: 100
    })

    const issue = res.data

    issueCard.number = issue.number
    issueCard.title = issue.title
    issueCard.body = issue.body
    issueCard.number = issue.number
    issueCard.html_url = issue.html_url
    issueCard.closed_at = DateOrNull(issue.closed_at)
    issueCard.created_at = DateOrNull(issue.created_at)
    issueCard.updated_at = DateOrNull(issue.updated_at)
    issueCard.assignee = issue.assignee
    issueCard.assignees = issue.assignees
    issueCard.labels = issue.labels

    issueCard.comments = []
    if (issue.comments > 0) {
      issueCard.comments = await this.getIssueComments(issueParts.owner, issueParts.repo, issueParts.issue_number)
    }

    issueCard.events = await this.octokit.paginate('GET /repos/:owner/:repo/issues/:id/events', {
      owner: issueParts.owner,
      repo: issueParts.repo,
      id: issueParts.issue_number,
      per_page: 100
    })

    return issueCard
  }

  //
  // This will get all open issues unioned with all issues changed in last n days
  // It will sort descending by updated time
  //
  // This focuses on two main scenarios:
  //   1. Slice and dice opened bugs by labels, assigned, milestone
  //   2. Get cycle time (time opened to closed etc.)
  //
  // https://developer.github.com/v3/issues/#parameters-3
  async getIssuesForRepo(repoUrl: string, daysAgo = 7): Promise<ProjectIssue[]> {
    const set = new IssueList(issue => issue.number)

    const rUrl = new url.URL(repoUrl)
    const parts = rUrl.pathname.split('/').filter(e => e)

    const repoProps = {
      owner: parts[0],
      repo: parts[1]
    }

    const opened = await this.octokit.paginate(
      'GET /repos/:owner/:repo/issues',
      {
        ...repoProps,
        state: 'open',
        per_page: 100
      },
      response => response.data.filter(issue => !issue.pull_request)
    )
    console.log(`Found ${opened.length} opened issues`)
    set.add(opened)

    // get Date n days ago as of mindnight (ensures cache hit if you run every 15 min)
    const dateAgo = new Date()
    dateAgo.setHours(0, 0, 0, 0)
    dateAgo.setDate(dateAgo.getDate() - daysAgo)

    console.log(`${daysAgo} days ago is ${dateAgo.toISOString()}`)

    const recentIssues = await this.octokit.paginate(
      'GET /repos/:owner/:repo/issues',
      {
        ...repoProps,
        since: dateAgo.toUTCString(),
        per_page: 100
      },
      response => response.data.filter(issue => !issue.pull_request)
    )
    console.log(`Found ${recentIssues.length} issues changed in last ${daysAgo} days.`)
    set.add(recentIssues)

    const issues = set.getItems()
    console.log(`Total of ${issues.length} distinct issues`)

    return issues
  }
}
