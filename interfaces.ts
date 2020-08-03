import { DistinctSet } from "./util";

export interface GeneratorConfiguration {
    name: string,
    // can be inlined or provide a relative path to another file
    targets: string | CrawlingConfig,
    filter: string,
    output: string,
    reports: ReportConfig[]    
}

export interface CrawlingTarget {
    type: 'project' | 'repo',
    htmlUrl: string,
    columnMap: { [key: string]: string[] },    
}

export type CrawlingConfig = {[name: string]: CrawlingTarget};

export interface ReportConfig {
    name: string,
    title: string,
    kind: 'markdown' | 'html',
    timezoneOffset: number,
    targets: string[],
    sections: ReportSection[],
    details: ReportDetails
}

export interface ReportSection {
    name: string,
    targets: string[];
    config: any
}

export interface ReportDetails {
    time: string,
    fullPath: string,
    rootPath: string,
    dataPath: string
}

export interface ReportSnapshotData {
    name: string,
    contents: string
}

export interface ReportSnapshot {
    datetime: Date,
    datetimeString: string, 
    rootPath: string,
    config: GeneratorConfiguration
}

export interface ProjectData {
    id: number,
    html_url: string,
    name: string,

    // TODO: should go away in favor of DistinctSet
    // stages: { [key: string]: ProjectIssue[] }
}

export interface IssueLabel {
    name: string
}

export interface IssueCardEventProject {
    project_id: number,
    column_name: string,
    previous_column_name: string,
    stage_name: string,
    previous_stage_name: string
}

export interface IssueEvent {
    created_at: Date,
    event: string,
    assignee: IssueUser,
    label: IssueLabel,
    project_card: IssueCardEventProject,
    //data: any
}

export interface IssueUser {
    login: string,
    id: number,
    avatar_url: string,
    url: string,
    html_url: string
}

export interface IssueMilestone {
    title: string,
    description: string,
    due_on: Date
}

export interface IssueComment {
    body: string,
    user: IssueUser
    created_at: Date,
    updated_at: Date
}

//
// shallow issue for bug slicing and dicing
//
export interface IssueSummary {
    title: string,
    number: number;
    html_url: string,
    state: string,
    labels: IssueLabel[],
    assignee: IssueUser,
    assignees: IssueUser[],
    user: IssueUser,
    milestone: IssueMilestone,
    closed_at: Date,
    created_at: Date,
    updated_at: Date
}

export interface ProjectIssue extends IssueSummary {
    labels: IssueLabel[],
    assignee: IssueUser,
    assignees: IssueUser[],
    user: IssueUser,
    milestone: IssueMilestone,
    closed_at: Date,
    created_at: Date,
    updated_at: Date,

    comments: IssueComment[],  
    
    //
    // project stage fields we decorate on issues
    //

    // first added to the board on any column (no "from" column)
    project_added_at: Date,
    
    // last occurence of moving to these columns from a lesser or no column
    // example. if moved to accepted from proposed (or less), 
    //      then in-progress (greater) and then back to accepted, first wins
    project_proposed_at: Date,        
    project_accepted_at: Date,
    project_in_progress_at: Date,

    // cleared if not currently blocked
    project_blocked_at: Date,

    // cleared if it moves out of done.  e.g. current state has to be done for this to be set
    project_done_at: Date,

    // current stage of this card on the board
    project_stage: string,
    
    events: IssueEvent[]
}

export interface IssueParameters {
    state: string,
    milestone: string,
    labels: string
}

export interface ProjectReportBuilder {
    // a report accepts project data (and it's stages) or a list of issues from a repo (and it's stages)
    reportType: "project" | "repo" | "any";
    getDefaultConfiguration(): any;
    process(config: any, data: ProjectData | DistinctSet, drillIn: (identifier: string, title: string, cards: ProjectIssue[]) => void): any;
    renderMarkdown(targets: CrawlingTarget[], processedData?: any): string;
    renderHtml(targets: CrawlingTarget[], processedData?: any): string;
}
