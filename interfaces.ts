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

export interface ProjectData {
    id: number,
    html_url: string,
    name: string,
    columns: { [key: string]: number }
    stages: { [key: string]: IssueCard[] }
}

export interface ProjectsData {
    projects: { [key: string]: ProjectData }
}

export interface IssueCardEvent {
    created: Date,
    event: string,
    data: any
}

export interface IssueCard {
    title: string,
    number: number;
    html_url: string,
    labels: string[],
    events: IssueCardEvent[]
}