import {GitHubClient} from './github';
import {IssueList, ProjectIssue, IssueEvent} from './project-reports-lib';
import {CrawlingTarget} from './interfaces';
import {URL} from 'url';

export class Crawler {
    // since multiple reports / sections can target (and rollup n targets), we need to crawl each once
    targetMap = {}
    github: GitHubClient;

    constructor(token: string, cachePath: string) {
        this.github = new GitHubClient(token, cachePath);
    }

    async crawl(target: CrawlingTarget): Promise<ProjectIssue[]> {
        if (this.targetMap[target.htmlUrl]) {
            return this.targetMap[target.htmlUrl];
        }

        // TODO: eventually deprecate ProjectData and only have distinct set
        let data: ProjectIssue[];
        if (target.type === 'project') {
            let projectCrawler = new ProjectCrawler(this.github);
            data = await projectCrawler.crawl(target);
        }
        else if (target.type === 'repo') {        
            console.log(`crawling repo ${target.htmlUrl}`);
            let repoCrawler = new RepoCrawler(this.github);
            data = await repoCrawler.crawl(target);
        }
        else {
            throw new Error(`Unsupported target config: ${target.type}`);
        }

        this.targetMap[target.htmlUrl] = data;
        return data;
    }

    getTargetData(): any {
        return this.targetMap;
    }
}

class RepoCrawler {
    github: GitHubClient;

    constructor(client: GitHubClient) {
        this.github = client;
    }

    public async crawl(target: CrawlingTarget): Promise<any[]> {
        console.log(`Crawling project ${target.htmlUrl} ...`);

        let set = new IssueList(issue => issue.number);
        let res = await this.github.getIssuesForRepo(target.htmlUrl);
        let summaries = res.map(issue => this.summarizeIssue(issue));
        console.log(`Crawled ${summaries.length} issues`);

        set.add(summaries);
        return set.getItems();
    }

    // walk events and rollup / summarize an issue for slicing and dicing.
    private summarizeIssue(issue): ProjectIssue {
        let summary = <ProjectIssue>{};
        summary.number = issue.number;
        summary.title = issue.title;
        summary.html_url = issue.html_url;
        summary.labels = issue.labels;
        // TODO: get events, comments and rollup up other "stage" data
        return summary;
    }
}

class ProjectCrawler {
    github: GitHubClient;

    // cache the resolution of stage names for a column
    // a columns by stage names are the default and resolve immediately
    columnMap = {
        "proposed": "Proposed",
        "accepted": "Accepted",
        "in-progress": "In-Progress",
        "done": "Done"
    }

    constructor(client: GitHubClient) {
        this.github = client;
    }

    public async crawl(target: CrawlingTarget): Promise<ProjectIssue[]> {
        console.log(`Crawling project ${target.htmlUrl} ...`);

        let issues: ProjectIssue[] = [];
        let columns: { [key: string]: number } = {};

        let projectData = await this.github.getProject(target.htmlUrl);
        if (!projectData) {
            throw new Error(`Could not find project ${target.htmlUrl}`);
        }

        let cols = await this.github.getColumnsForProject(projectData);
        cols.forEach((col) => {
            columns[col.name] = col.id;
        })

        let mappedColumns = [];
        for (const key in target.columnMap) {
            let colNames = target.columnMap[key];
            if (!colNames || !Array.isArray) {
                throw new Error(`Invalid config. column map for ${key} is not an array`);
            }

            mappedColumns = mappedColumns.concat(colNames);
        }

        let seenUnmappedColumns: string[] = [];

        for (const key in target.columnMap) {
            console.log(`Processing stage ${key}`);
            let colNames = target.columnMap[key];

            for (const colName of colNames) {
                let colId = columns[colName];

                // it's possible the column name is a previous column name
                if (!colId) {
                    continue;
                }

                let cards = await this.github.getCardsForColumns(colId, colName);

                for (const card of cards) {
                    // called as each event is processed 
                    // creating a list of mentioned columns existing cards in the board in events that aren't mapped in the config
                    // this will help diagnose a potential config issue much faster
                    let eventCallback = (event: IssueEvent):void => {
                        let mentioned = [];
                        if (event.project_card && event.project_card.column_name) {
                            mentioned.push(event.project_card.column_name);
                        }

                        if (event.project_card && event.project_card.previous_column_name) {
                            mentioned.push(event.project_card.previous_column_name);
                        }                        

                        for (let mention of mentioned) {
                            if (mappedColumns.indexOf(mention) === -1 && seenUnmappedColumns.indexOf(mention) === -1) {
                                seenUnmappedColumns.push(mention);
                            }
                        }
                    }

                    // cached since real column could be mapped to two different mapped columns
                    // read and build the event list once
                    
                    let issueCard = await this.github.getIssueForCard(card, projectData.id);
                    if (issueCard) {
                        this.processCard(issueCard, projectData.id, target, eventCallback);
                        issues.push(issueCard);
                    }
                    else {
                        let contents = card["note"];
                        try {
                            new URL(contents);
                            console.log(contents);
                            console.log("WWARNING: card found that is not an issue but has contents of an issues url that is not part of the project");
                        }
                        catch{
                            console.log(`ignoring note: ${contents}`);
                        }
                    }
                }
            }
        }

        console.log("Done processing.")
        console.log();
        if (seenUnmappedColumns.length > 0) {
            console.log();
            console.log(`WARNING: there are unmapped columns mentioned in existing cards on the project board`);
            seenUnmappedColumns = seenUnmappedColumns.map(col => `"${col}"`);
            console.log(`WARNING: Columns are ${seenUnmappedColumns.join(" ")}`);
            console.log();
        }

        return issues;
    }

    //
    // Add logical stages to the events.
    // filter out events not for the project being crawled (issue can belond to multiple boards)
    //
    public processCard(card: ProjectIssue, projectId: number, target: CrawlingTarget, eventCallback: (event: IssueEvent) => void): void {
        if (!projectId) {
            throw new Error('projectId not set');
        }

        let filteredEvents = [];

        // card events should be in order chronologically
        let currentStage: string;
        let doneTime: Date;
        let blockedTime: Date;
        let addedTime: Date;

        if (card.events) {
            for (let event of card.events) {
                // since we're adding this card to a projects / stage, let's filter out
                // events for other project ids since an issue can be part of multiple boards
                if (event.project_card && event.project_card.project_id !== projectId) {
                    continue;
                }

                eventCallback(event);

                if (event.project_card && event.project_card.column_name) {
                    let stage = this.getStageFromColumn(event.project_card.column_name, target);
                    if (!stage) {
                        console.log(`WARNING: could not map for column ${event.project_card.column_name}`);
                    }
                    event.project_card.stage_name =  stage || "Unmapped";
                }
        
                if (event.project_card && event.project_card.previous_column_name) {
                    let previousStage = this.getStageFromColumn(event.project_card.previous_column_name, target)
                    if (!previousStage) {
                        console.log(`WARNING: could not map for previous column ${event.project_card.previous_column_name}`);
                    }                    
                    event.project_card.previous_stage_name =  previousStage || "Unmapped";
                }

                filteredEvents.push(event);
            }
            card.events = filteredEvents;
        }
    } 
    
    private getStageFromColumn(column: string, target: CrawlingTarget): string {
        column = column.toLowerCase();
        if (this.columnMap[column]) {
            return this.columnMap[column];
        }

        let resolvedStage = null;
        for (let stageName in target.columnMap) {
            // case insensitve match
            for (let mappedColumn of target.columnMap[stageName].filter(e => e)) {
                let lowerColumn = mappedColumn.toLowerCase();
                if (lowerColumn === column.toLowerCase()) {
                    resolvedStage = stageName;
                    break;
                }
            }

            if (resolvedStage) {
                break;
            }
        }

        // cache the n^2 reverse case insensitive lookup.  it will never change for this run
        if (resolvedStage) {
            this.columnMap[column] = resolvedStage;
        }

        return resolvedStage;
    }    
}