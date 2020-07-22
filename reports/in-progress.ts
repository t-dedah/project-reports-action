import {ProjectData, IssueCard} from '../interfaces';
import * as rptLib from '../project-reports-lib';
const tablemark = require('tablemark')
import * as os from 'os';

/*
 * Gives visibility into whether the team has untriaged debt, an approval bottleneck and 
 * how focused the team is (e.g. how many efforts are going on)
 * A wip is a work in progress unit of resourcing.  e.g. it may be one developer or it might mean 4 developers.
 */
export function getDefaultConfiguration(): any {
    return <any>{
        // Takes a single type since settings like daysAgo might be different by type.
        // Can add multiple sections on report if you want more
        "report-on": 'Epic',
        // TODO: implement getting a shapshot of data n days ago
        "daysAgo": 7,
        "status-label-match": "(?<=status:).*"
    };
}

//
// Builds a reporting structure of in-progress cards keyed by card type ('Epic', etc)
//
// <ProgressData>{
//     "Epic": <IssueCardEx[]>[]
//      ...
//

export type ProgressData = { 
    cardType: string,  
    cards: IssueCardEx[] 
}

export interface IssueCardEx extends IssueCard {
    status: string;
}

export function process(config: any, projData: ProjectData, drillIn: (identifier: string, title: string, cards: IssueCard[]) => void): any {

    let progressData = <ProgressData>{};
    progressData.cardType = config["report-on"];

    let cards = projData.stages["In-Progress"];
    if (!cards) {
        // if the column exists but has no cards, that's fine, it will no get here. 
        // It would have to be a non existant column which is a config problem so fail.
        throw new Error("In-Progress column does not exist");
    }

    let cardsForType = rptLib.cardsWithLabel(cards, progressData.cardType) as IssueCardEx[];

    // add status to each card from the status label
    cardsForType.map((card: IssueCardEx) => {
        card.status = rptLib.getStringFromLabel(card, new RegExp(config["status-label-match"]));
        return card;
    });

    progressData.cards = cardsForType;

    return progressData;
}

interface ProgressRow {
    title: string,
    status: string
}

export function renderMarkdown(projData: ProjectData, processedData: any): string {
    let progressData = processedData as ProgressData;
    
    let lines: string[] = [];

    lines.push(`## In Progress: ${progressData.cardType}  `);
    lines.push("  ");

    let rows: ProgressRow[] = [];
    for (let card of processedData.cards) {
        let progressRow = <ProgressRow>{};
        progressRow.title = card.title;
        progressRow.status = card.status;

        rows.push(progressRow);
    }

    let table: string;
    if (rows && rows.length > 0) {
        table = tablemark(rows);
    }
    else {
        table = `No ${progressData.cardType}s found.`;
    }
    
    lines.push(table);
    lines.push("  ");

    return lines.join(os.EOL);
}

export function renderHtml(): string {
    // Not supported yet
    return "";
}


