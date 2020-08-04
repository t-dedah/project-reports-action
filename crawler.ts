import {CrawlingTarget, ProjectData, ProjectIssue, IssueSummary, IssueEvent} from './interfaces';
import {GitHubClient} from './github';
import {DistinctSet} from './util';

export class Crawler {
    // since multiple reports / sections can target (and rollup n targets), we need to crawl each once
    targetMap = {}
    github: GitHubClient;

    constructor(token: string, cachePath: string) {
        this.github = new GitHubClient(token, cachePath);
    }

    async crawl(target: CrawlingTarget): Promise<IssueSummary[]> {
        if (this.targetMap[target.htmlUrl]) {
            return this.targetMap[target.htmlUrl];
        }

        // TODO: eventually deprecate ProjectData and only have distinct set
        let data: IssueSummary[];
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

        let set = new DistinctSet(issue => issue.number);
        let res = await this.github.getIssuesForRepo(target.htmlUrl);
        let summaries = res.map(issue => this.summarizeIssue(issue));
        console.log(`Crawled ${summaries.length} issues`);

        set.add(summaries);
        return set.getItems();
    }

    // walk events and rollup / summarize an issue for slicing and dicing.
    private summarizeIssue(issue): IssueSummary {
        let summary = <IssueSummary>{};
        summary.number = issue.number;
        summary.title = issue.title;
        summary.html_url = issue.html_url;
        summary.labels = issue.labels;
        // TODO: get events, comments and rollup up other "stage" data
        return summary;
    }
}

let stageLevel = {
    "None": 0,
    "Proposed": 1,
    "Accepted": 2,
    "In-Progress": 3,
    "Blocked": 4,
    "Done": 5
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

    // keep in order indexed by level above
    stageAtNames = [
        'none',
        'project_proposed_at',
        'project_accepted_at',
        'project_in_progress_at',
        'project_blocked_at',
        'project_done_at'
    ]

    constructor(client: GitHubClient) {
        this.github = client;
    }

    public async crawl(target: CrawlingTarget): Promise<ProjectIssue[]> {
        console.log(`Crawling project ${target.htmlUrl} ...`);

        let issues: ProjectIssue[] = [];
        let columns: { [key: string]: number } = {};

        let projectData = await this.github.getProject(target.htmlUrl);

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
                        let mentioned;
                        if (event.project_card && event.project_card.column_name) {
                            mentioned = event.project_card.column_name;
                        }

                        if (event.project_card && event.project_card.previous_column_name) {
                            mentioned = event.project_card.previous_column_name;
                        }                        

                        if (mentioned && mappedColumns.indexOf(mentioned) === -1 && seenUnmappedColumns.indexOf(mentioned) === -1) {
                            seenUnmappedColumns.push(mentioned);
                        }
                    }

                    // cached since real column could be mapped to two different mapped columns
                    // read and build the event list once
                    let issueCard = await this.github.getIssueForCard(card, projectData.id);
                    if (issueCard) {
                        this.processCard(issueCard, projectData.id, target, eventCallback);
                        if (!issueCard["project_stage"]) {
                            // TODO: add these to an anomolies report via callback
                            // report consumers don't read actions output and they need to react
                            console.log(`WARNING: project_stage not set for ${issueCard.html_url}`);
                            issueCard["project_stage"] = "Missing";
                        }
                        //projectData.stages[key].push(issueCard);
                        issues.push(issueCard);
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

    // process a card in context of the project it's being added to
    // filter column events to the project being processed only since. this makes it easier on the report author
    // add stage name to column move events so report authors don't have to repeatedly to that
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

                let eventDateTime: Date;
                if (event.created_at) {
                    eventDateTime = event.created_at;
                }

                // TODO: should I clear all the stage_at datetimes if I see
                //       removed_from_project event?

                let toStage: string;
                let toLevel: number;
                let fromStage: string;
                let fromLevel: number = 0;

                if (event.project_card && event.project_card.column_name) {
                    if (!addedTime) {
                        addedTime = eventDateTime;
                    }

                    toStage = event.project_card.stage_name = this.getStageFromColumn(event.project_card.column_name, target);
                    toLevel = stageLevel[toStage];
                    currentStage = toStage;
                }
        
                if (event.project_card && event.project_card.previous_column_name) {
                    fromStage = event.project_card.previous_stage_name = this.getStageFromColumn(event.project_card.previous_column_name, target);
                    fromLevel = stageLevel[fromStage];
                }

                // last occurence of moving to these columns from a lesser or no column
                // example. if moved to accepted from proposed (or less), 
                //      then in-progress (greater) and then back to accepted, first wins            
                if (toStage === 'Proposed' || toStage === 'Accepted' || toStage === 'In-Progress') {
                    if (toLevel > fromLevel) {
                        card[this.stageAtNames[toLevel]] = eventDateTime;
                        console.log(`${this.stageAtNames[toLevel]}: ${eventDateTime}`);
                    } 
                }

                if (toStage === 'Done') {
                    doneTime = eventDateTime;
                }

                filteredEvents.push(event);
            }
            card.events = filteredEvents;

            // done_at and blocked_at is only set if it's currently at that stage
            if (currentStage === 'Done') {
                card.project_done_at = doneTime;
                console.log(`project_done_at: ${card.project_done_at}`);
            }

            if (addedTime) {
                card.project_added_at = addedTime;
                console.log(`project_added_at: ${card.project_added_at}`);
            }

            card.project_stage = currentStage;
            console.log(`project_stage: ${card.project_stage}`);
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
            for (let mappedColumn of target.columnMap[stageName]) {
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