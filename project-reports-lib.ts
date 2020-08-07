import {IssueCard} from './interfaces';

// TODO: separate npm module.  for now it's a file till we flush out

export * from './project-reports-schemes';

//
// filter cards by label
//
export function filterByLabel(cards: IssueCard[], name: string): IssueCard[] {
    return cards.filter((card) => card.labels.findIndex(label => label.name.toLowerCase() === name.toLowerCase()) >= 0);
}

export function diffDays(start: Date, end: Date): number {
    const difference = end.getTime() - start.getTime();
    return difference / (1000 * 60 * 60 * 24);
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
