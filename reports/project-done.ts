import {ProjectIssue, CrawlingTarget} from '../interfaces';
import {ProjectStages, ProjectStageIssues} from '../project-reports-lib';
import * as rptLib from '../project-reports-lib';
const tablemark = require('tablemark')
import * as os from 'os';

let clone = require('clone');

const reportType = 'project';
export {reportType};

/*
 * Gives visibility into whether the team has untriaged debt, an approval bottleneck and 
 * how focused the team is (e.g. how many efforts are going on)
 * A wip is a work in progress unit of resourcing.  e.g. it may be one developer or it might mean 4 developers.
 */
export function getDefaultConfiguration(): any {
    return <any>{
        "report-on": 'Epic',
        "daysAgo": 7
    };
}

export type CompletedCards = { 
    cardType: string,
    daysAgo: number,  
    cards: ProjectIssue[] 
}


export function process(config: any, issues: ProjectIssue[], drillIn: (identifier: string, title: string, cards: ProjectIssue[]) => void): any {
    console.log("> project-done::process");
    let completedCards = <CompletedCards>{};

    completedCards.cardType = config["report-on"];

    let daysAgo = config['daysAgo'];
    if (isNaN(daysAgo)) {
        throw new Error("daysAgo is not a number");
    }
    completedCards.daysAgo = daysAgo;

    var dateAgo = new Date();
    dateAgo.setDate(dateAgo.getDate() - config['daysAgo']);

    console.log(`Getting cards for ${completedCards.cardType}`);
    let cardsForType = completedCards.cardType === '*'? clone(issues) : clone(rptLib.filterByLabel(issues, completedCards.cardType.toLowerCase()) as ProjectIssue[]);

    completedCards.cards = cardsForType.filter(issue => issue["project_done_at"] && new Date(issue["project_done_at"]) > dateAgo);

    return completedCards;
}

interface CompletedRow {
    assigned: string,
    title: string,
    completed: string,    
}

export function renderMarkdown(targets: CrawlingTarget[], processedData: any): string {
    console.log("> project-done::renderMarkdown");
    let completedCards = processedData as CompletedCards;
    
    let lines: string[] = [];
    let typeLabel = processedData.cardType === '*' ? "" : `${completedCards.cardType}s`;

    lines.push(`## :checkered_flag: Completed ${typeLabel} last ${completedCards.daysAgo} days  `);
    lines.push("  ");

    let rows: CompletedRow[] = [];
    for (let card of processedData.cards) {
        let doneRow = <CompletedRow>{};

        let assigned= card.assignee;
        if (!assigned && card.assignees && card.assignees.length > 0) {
            assigned = card.assignees[0];
        }

        doneRow.assigned = assigned ? `<img height="20" width="20" alt="@${assigned.login}" src="${assigned.avatar_url}"/> <a href="${assigned.html_url}">${assigned.login}</a>` : ":triangular_flag_on_post:";
        doneRow.title = `[${card.title}](${card.html_url})`;
        doneRow.completed = new Date(card["project_done_at"]).toDateString();

        rows.push(doneRow);
    }

    let table: string;
    if (rows && rows.length > 0) {
        table = tablemark(rows);
    }
    else {
        table = `No ${completedCards.cardType}s found.`;
    }
    
    lines.push(table);
    lines.push("  ");

    return lines.join(os.EOL);
}

export function renderHtml(): string {
    // Not supported yet
    return "";
}


