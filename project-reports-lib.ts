import {IssueCard} from './interfaces';

// TODO: separate npm module.  for now it's a file till we flush out

export * from './project-reports-schemes';

//
// filter cards by label
//
export function filterByLabel(cards: IssueCard[], name: string): IssueCard[] {
    return cards.filter((card) => card.labels.findIndex(label => label.name.toLowerCase() === name.toLowerCase()) >= 0);
}

//
// Calculate cycle time for a card
// The time, in days, a unit of work spends between the first day it is actively being worked on until the day it is closed.
// In this case, since a project card has events, we look for the event that moved or added a card to the "Accepted" column
// and subtract it from the time that the card moved to the `Done` column.
//
export function calculateCycleTime(card: IssueCard): number {
    // console.log(`Calculating cycle time for [${card.title}]`);

    // cycle time starts at Accepted, ends at Done.
    let accepted_time:Date = null;
    let done_time:Date = null;
    card.events.forEach((event)=> {
        if (event.event == "added_to_project") {
            if (event.project_card.stage_name == "Accepted") {
                accepted_time = new Date(event.created_at);
            }
        } else if (event.event == "moved_columns_in_project" ) {
            if (event.project_card.stage_name == "Accepted") {
                accepted_time = new Date(event.created_at);
            }
            else if (event.project_card.stage_name == "Done") {
                done_time = new Date(event.created_at);
            }
        }
    });

    if (accepted_time == null || done_time == null) {
        return 0;
    }

    const difference = done_time.getTime() - accepted_time.getTime();
    const cycleTimeInDays = difference / (1000 * 60 * 60 * 24);
    return cycleTimeInDays;
}

//
// Get number from a label by regex.  
// e.g. get 2 from label "2-wip", new RegExp("(\\d+)-wip")
// returns NaN if no labels match
//
export function getCountFromLabel(card: IssueCard, re: RegExp): number {
    let num = NaN;

    for (let label of card.labels) {
        let matches = label.name.match(re);
        if (matches && matches.length > 0) {
             num = parseInt(matches[1])
             if (num) {
                 break;
             }
        }
    }
    return num;
}

export function getStringFromLabel(card: IssueCard, re: RegExp): string {
    let str = '';

    for (let label of card.labels) {
        let matches = label.name.match(re);
        if (matches && matches.length > 0) {
             str = matches[0];
             if (str) {
                 break;
             }
        }
    }

    if (str) {
        str = str.trim();
    }

    return str;
}

export function sumCardProperty(cards: IssueCard[], prop: string): number {
    return cards.reduce((a, b) => a + (b[prop] || 0), 0);
}
