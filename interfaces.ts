import {GitHubClient} from './github'
import {IssueList, ProjectIssue} from './project-reports-lib'

export interface GeneratorConfiguration {
  name: string
  // can be inlined or provide a relative path to another file
  targets: string | CrawlingConfig
  filter: string
  output: string
  processing: ProcessingSection[]
  reports: ReportConfig[]
}

export interface CrawlingTarget {
  type: 'project' | 'repo'
  htmlUrl: string
  columnMap: {[key: string]: string[]}
  // only needed for type project
  projectId?: number
  stages: boolean
}

export type CrawlingConfig = {[name: string]: CrawlingTarget}

export interface ProcessingSection {
  name: string
  target: string
  config: any
}

export interface ReportConfig {
  name: string
  title: string
  kind: 'markdown' | ''
  timezoneOffset: number
  targets: string[]
  sections: ReportSection[]
  details: ReportDetails
}

export interface ReportSection {
  name: string
  targets: string[]
  config: any
}

export interface ReportDetails {
  time: string
  fullPath: string
  rootPath: string
  dataPath: string
}

export interface ReportSnapshotData {
  name: string
  contents: string
}

export interface ReportSnapshot {
  datetime: Date
  datetimeString: string
  rootPath: string
  config: GeneratorConfiguration
}

export interface ProjectData {
  id: number
  html_url: string
  name: string

  // TODO: should go away in favor of DistinctSet
  // stages: { [key: string]: ProjectIssue[] }
}

export interface IssueParameters {
  state: string
  milestone: string
  labels: string
}

export interface RuntimeModule {
  getDefaultConfiguration(): any
}

// process a list of issues from a target
export interface ProjectProcessor extends RuntimeModule {
  targetType: 'project' | 'repo' | 'any'

  // async
  process(target: CrawlingTarget, config: any, data: IssueList, github: GitHubClient): Promise<void>
}

export interface ProjectReportBuilder extends RuntimeModule {
  reportType: 'project' | 'repo' | 'any'
  // a report accepts project data (and it's stages) or a list of issues from a repo (and it's stages)
  process(
    config: any,
    data: IssueList,
    drillIn: (identifier: string, title: string, cards: ProjectIssue[]) => void
  ): any
  renderMarkdown(targets: CrawlingTarget[], processedData?: any): string
}
