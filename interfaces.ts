export interface ReportSection {
    name: string,
    config: any
}

export interface ReportDetails {
    time: string
}

export interface ReportConfig {
    name: string,
    title: string,
    kind: 'markdown' | 'html',
    timezoneOffset: number,
    sections: ReportSection[],
    details: ReportDetails
}

export interface GeneratorConfiguration {
    name: string,
    columnMap: { [key: string]: string[] },
    projects: string[],
    filter: string,
    output: string,
    reports: ReportConfig[]    
}

export interface ReportSnapshotData {
    name: string,
    contents: string
}

export interface ReportSnapshot {
    datetime: Date,
    datetimeString: string, 
    config: GeneratorConfiguration
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

export interface IssueUser {
    login: string,
    id: number,
    avatar_url: string,
    url: string,
    html_url: string
}

export interface IssueCard {
    title: string,
    number: number;
    html_url: string,
    labels: string[],
    assignee: IssueUser,
    closed_at: Date,
    created_at: Date,
    updated_at: Date,  
    
    // first added to the board on any column (no "from" column)
    added_at: Date,
    
    // last occurence of moving to these columns from a lesser or no column
    // example. if moved to accepted from proposed (or less), 
    //      then in-progress (greater) and then back to accepted, first wins
    proposed_at: Date,        
    accepted_at: Date,
    in_progress_at: Date,

    // cleared if not currently blocked
    blocked_at: Date,

    // cleared if it moves out of done.  e.g. current state has to be done for this to be set
    done_at: Date,

    // current stage of this card on the board
    stage: string,
    
    events: IssueCardEvent[]
}

export interface ProjectReportBuilder {
    getDefaultConfiguration(): any;
    process(config: any, data: ProjectData, drillIn: (identifier: string, title: string, cards: IssueCard[]) => void): any;
    renderMarkdown(projData: ProjectData, processedData?: any): string;
    renderHtml(projData: ProjectData, processedData?: any): string;
}
