import {ProjectData, IssueCard} from '../interfaces';
import * as rptLib from '../project-reports-lib';
const tablemark = require('tablemark')
import * as os from 'os';

let clone = require('clone');

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
        "status-label-match": "(?<=status:).*",
        "wip-label-match": "(\\d+)-wip",
        "last-updated-days-flag": 3.0,
        "last-updated-scheme": "LastCommentPattern", 
        "last-updated-scheme-data": "^(#){1,4} update",       
    };
}

export type ProgressData = { 
    cardType: string,  
    cards: IssueCardEx[] 
}

export interface IssueCardEx extends IssueCard {
    status: string;
    wips: number;
    hoursLastUpdated: number;
    flagHoursLastUpdated: boolean;
    hoursInProgress: number;
}

let statusLevels = {
    "": 0,  // no status
    "red": 1,
    "yellow": 2,
    "green": 3
}

// sort by status
export function sortCards(card1: IssueCardEx, card2: IssueCardEx) {
    // Sort first on day
    if(statusLevels[card1.status] > statusLevels[card2.status]) {
        return 1;
    } else if (statusLevels[card1.status] < statusLevels[card2.status]) {
        return -1;
    } else {
        // if the status is the same
        // subsort by hours in progress

        if(card1.hoursInProgress < card2.hoursInProgress) {
            return 1;
        } else if (card1.hoursInProgress > card2.hoursInProgress) {
            return -1;
        } else {
            return 0;
        }
    }
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

    let cardsForType = clone(rptLib.filterByLabel(cards, progressData.cardType.toLowerCase()) as IssueCardEx[]);

    // add status to each card from the status label
    cardsForType.map((card: IssueCardEx) => {
        card.wips = rptLib.getCountFromLabel(card, new RegExp(config["wip-label-match"])) || 0;
        card.hoursLastUpdated = rptLib.dataFromCard(card, config["last-updated-scheme"], config["last-updated-scheme-data"]);
        card.flagHoursLastUpdated = card.hoursLastUpdated < 0 || card.hoursLastUpdated / 24 > config["last-updated-days-flag"];
        let status = rptLib.getStringFromLabel(card, new RegExp(config["status-label-match"])).toLowerCase();
        card.status = statusLevels[status] ? status : "";
        card.hoursInProgress = -1; 
        if (card.project_in_progress_at) {
            card.hoursInProgress = rptLib.diffHours(new Date(card.project_in_progress_at), new Date());
        }

        return card;
    });

    cardsForType.sort(sortCards);

    progressData.cards = cardsForType;

    return progressData;
}

interface ProgressRow {
    assigned: string,
    title: string,
    status: string,
    wips: number,
    daysInProgress: string,    
    daysLastUpdated: string,
}

export function renderMarkdown(projData: ProjectData, processedData: any): string {
    let progressData = processedData as ProgressData;
    
    let lines: string[] = [];

    lines.push(`## :hourglass_flowing_sand: In Progress ${progressData.cardType}s  `);
    lines.push(`<sub><sup>Sorted by status and then in progress time descending</sup></sub>  `);
    lines.push("  ");


    let rows: ProgressRow[] = [];
    for (let card of processedData.cards) {
        let progressRow = <ProgressRow>{};

        let statusEmoji = ":exclamation:";
        switch (card.status.toLowerCase()) {
            case "red": 
                statusEmoji = ":heart:"; break;
            case "green":
                statusEmoji = ":green_heart:"; break;
            case "yellow":
                statusEmoji = ":yellow_heart:"; break;
        }

        let assigned= card.assignee;
        if (!assigned && card.assignees && card.assignees.length > 0) {
            assigned = card.assignees[0];
        }

        progressRow.assigned = assigned ? `<img height="20" width="20" alt="@${assigned.login}" src="${assigned.avatar_url}"/> <a href="${assigned.html_url}">${assigned.login}</a>` : ":triangular_flag_on_post:";
        progressRow.title = `[${card.title}](${card.html_url})`;
        progressRow.status = statusEmoji;
        progressRow.wips = card.wips;
        progressRow.daysLastUpdated = card.hoursLastUpdated > 0 ? (card.hoursLastUpdated/24).toFixed(1) : '';
        if (card.flagHoursLastUpdated) {
            progressRow.daysLastUpdated += " :triangular_flag_on_post:";
        }
        
        progressRow.daysInProgress = card.hoursInProgress > 0 ? (card.hoursInProgress/24).toFixed(1) : "";

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


