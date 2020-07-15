export interface ReportConfiguration {
    name: string,
    configuration: any
}

export interface GeneratorConfiguration {
    name: string,
    columnMap: any,
    projects: string[],
    filter: string,
    reports: ReportConfiguration[]    
}

export interface ReportSnapshotItem {
    name: string,
    report: any,
    snapshot: any[]  // TODO: change to issuesummary[]
}

export interface ReportSnapshot {
    datetime: Date,
    config: GeneratorConfiguration,
    snapshots: ReportSnapshotItem[]
}

export interface IssueInfo {
    title: string
}

export interface ProjectData {
    id: number,
    html_url: string,
    name: string,
    stages: { [key: string]: IssueInfo[] }
}

export interface ProjectsData {
    projects: { [key: string]: ProjectData }
}