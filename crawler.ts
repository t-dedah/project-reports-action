import {URL} from 'url'
import {GitHubClient} from './github'
import {CrawlingTarget} from './interfaces'
import {fuzzyMatch, IssueEvent, IssueList, ProjectColumn, ProjectIssue} from './project-reports-lib'

export class Crawler {
  // since multiple reports / sections can target (and rollup n targets), we need to crawl each once
  targetMap = {}
  github: GitHubClient

  constructor(token: string, cachePath: string) {
    this.github = new GitHubClient(token, cachePath)
  }

  async crawl(target: CrawlingTarget): Promise<ProjectIssue[]> {
    if (this.targetMap[target.htmlUrl]) {
      return this.targetMap[target.htmlUrl]
    }

    // TODO: eventually deprecate ProjectData and only have distinct set
    let data: ProjectIssue[]
    if (target.type === 'project') {
      const projectCrawler = new ProjectCrawler(this.github)
      data = await projectCrawler.crawl(target)
    } else if (target.type === 'repo') {
      console.log(`crawling repo ${target.htmlUrl}`)
      if (target.stages) {
        throw new Error('Invalid config.  repo targets do not have stages')
      }

      const repoCrawler = new RepoCrawler(this.github)
      data = await repoCrawler.crawl(target)
    } else {
      throw new Error(`Unsupported target config: ${target.type}`)
    }

    this.targetMap[target.htmlUrl] = data
    return data
  }

  getTargetData(): any {
    return this.targetMap
  }
}

class RepoCrawler {
  github: GitHubClient

  constructor(client: GitHubClient) {
    this.github = client
  }

  public async crawl(target: CrawlingTarget): Promise<any[]> {
    console.log(`Crawling project ${target.htmlUrl} ...`)

    const set = new IssueList(issue => issue.number)
    const res = await this.github.getIssuesForRepo(target.htmlUrl)
    const summaries = res.map(issue => this.summarizeIssue(issue))
    console.log(`Crawled ${summaries.length} issues`)

    set.add(summaries)
    return set.getItems()
  }

  // walk events and rollup / summarize an issue for slicing and dicing.
  private summarizeIssue(issue): ProjectIssue {
    const summary = <ProjectIssue>{}
    summary.number = issue.number
    summary.title = issue.title
    summary.html_url = issue.html_url
    summary.labels = issue.labels
    // TODO: get events, comments and rollup up other "stage" data
    return summary
  }
}

class ProjectCrawler {
  github: GitHubClient

  // cache the resolution of stage names for a column
  // a columns by stage names are the default and resolve immediately
  resolvedColumns = {
    proposed: 'Proposed',
    accepted: 'Accepted',
    'in-progress': 'In-Progress',
    done: 'Done'
  }

  constructor(client: GitHubClient) {
    this.github = client
  }

  public async crawl(target: CrawlingTarget): Promise<ProjectIssue[]> {
    console.log(`Crawling project ${target.htmlUrl} ...`)

    const issues: ProjectIssue[] = []

    const projectData = await this.github.getProject(target.htmlUrl)
    if (!projectData) {
      throw new Error(`Could not find project ${target.htmlUrl}`)
    }

    const columns: ProjectColumn[] = await this.github.getColumnsForProject(projectData)

    let mappedColumns = []
    for (const stageName in target.columnMap) {
      const colNames = target.columnMap[stageName]
      if (!colNames || !Array.isArray) {
        throw new Error(`Invalid config. column map for ${stageName} is not an array`)
      }

      mappedColumns = mappedColumns.concat(colNames)
    }

    if (!target.stages && mappedColumns.length > 0) {
      throw new Error('Project target has mapped columns but stages is false.  Set stages: true')
    }

    let seenUnmappedColumns: string[] = []
    for (const column of columns) {
      console.log()
      console.log(`>> Processing column ${column.name} (${column.id})`)

      const cards = await this.github.getCardsForColumns(column.id)

      for (const card of cards) {
        // called as each event is processed
        // creating a list of mentioned columns existing cards in the board in events that aren't mapped in the config
        // this will help diagnose a potential config issue much faster
        const eventCallback = (event: IssueEvent): void => {
          const mentioned = []
          if (event.project_card && event.project_card.column_name) {
            mentioned.push(event.project_card.column_name)
          }

          if (event.project_card && event.project_card.previous_column_name) {
            mentioned.push(event.project_card.previous_column_name)
          }

          for (const mention of mentioned) {
            if (mappedColumns.indexOf(mention.trim()) === -1 && seenUnmappedColumns.indexOf(mention) === -1) {
              seenUnmappedColumns.push(mention)
            }
          }
        }

        // cached since real column could be mapped to two different mapped columns
        // read and build the event list once

        const issueCard = await this.github.getIssueForCard(card)

        if (issueCard) {
          issueCard['project_stage'] = 'None'
          if (target.stages) {
            this.processCard(issueCard, projectData.id, target, eventCallback)
            issueCard['project_stage'] = this.getStageFromColumn(column.name, target)
          }

          issueCard['project_column'] = column.name

          console.log(`stage: ${issueCard.project_stage}`)
          console.log()
          issues.push(issueCard)
        } else {
          const contents = card['note']
          try {
            new URL(contents)
            console.log(contents)
            console.log(
              'WWARNING: card found that is not an issue but has contents of an issues url that is not part of the project'
            )
          } catch {
            console.log(`ignoring note: ${contents}`)
          }
        }
      }
    }

    console.log('Done processing.')
    console.log()
    if (target.stages && seenUnmappedColumns.length > 0) {
      console.log()
      console.log(`WARNING: there are unmapped columns mentioned in existing cards on the project board`)
      seenUnmappedColumns = seenUnmappedColumns.map(col => `"${col}"`)
      console.log(`WARNING: Columns are ${seenUnmappedColumns.join(' ')}`)
      console.log()
    }

    return issues
  }

  //
  // Add logical stages to the events.
  // filter out events not for the project being crawled (issue can belond to multiple boards)
  //
  public processCard(
    card: ProjectIssue,
    projectId: number,
    target: CrawlingTarget,
    eventCallback: (event: IssueEvent) => void
  ): void {
    if (!projectId) {
      throw new Error('projectId not set')
    }

    console.log()
    console.log(`Processing card ${card.title}`)
    console.log(card.html_url)

    const filteredEvents = []

    if (card.events) {
      console.log(`Filtering ${card.events.length} events for project ${projectId}`)
      for (const event of card.events) {
        // since we're adding this card to a projects / stage, let's filter out
        // events for other project ids since an issue can be part of multiple boards
        if (event.project_card && event.project_card.project_id !== projectId) {
          continue
        }

        eventCallback(event)

        if (event.project_card && event.project_card.column_name) {
          const stage = this.getStageFromColumn(event.project_card.column_name, target)
          if (!stage) {
            console.log(`WARNING: could not map for column ${event.project_card.column_name}`)
          }
          event.project_card.stage_name = stage || 'Unmapped'
          console.log(
            `${event.created_at}(${event.project_card.project_id}): ${event.project_card.column_name} => ${event.project_card.stage_name}`
          )
        }

        if (event.project_card && event.project_card.previous_column_name) {
          const previousStage = this.getStageFromColumn(event.project_card.previous_column_name, target)
          if (!previousStage) {
            console.log(`WARNING: could not map for previous column ${event.project_card.previous_column_name}`)
          }
          event.project_card.previous_stage_name = previousStage || 'Unmapped'
          console.log(
            `${event.created_at}(${event.project_card.project_id}): ${event.project_card.previous_column_name} => ${event.project_card.previous_stage_name}`
          )
        }

        filteredEvents.push(event)
      }
      card.events = filteredEvents
    }
    console.log(`Filtered to ${card.events.length} events`)
  }

  private getStageFromColumn(column: string, target: CrawlingTarget): string {
    if (this.resolvedColumns[column]) {
      return this.resolvedColumns[column]
    }

    let resolvedStage = null
    for (const stageName in target.columnMap) {
      // case insensitve match
      for (const mappedColumn of target.columnMap[stageName].filter(e => e)) {
        if (fuzzyMatch(column, mappedColumn)) {
          resolvedStage = stageName
          break
        }
      }

      if (resolvedStage) {
        break
      }
    }

    // cache the n^2 reverse case insensitive lookup.  it will never change for this run
    if (resolvedStage) {
      this.resolvedColumns[column] = resolvedStage
    }

    return resolvedStage
  }
}
