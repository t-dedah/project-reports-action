import {IssueCard} from './interfaces';
//import * as filters from './project-report-lib-filters';

// TODO: separate npm module.  for now it's a file till we flush out

export function dataFromCard(card: IssueCard, filterBy: string, data: string) {
    
    let fn = module.exports[`get${filterBy}`];
    if (!fn) { 
        throw new Error(`Invalid filter: ${filterBy}`); 
    }

    return fn(card, data);
}

export function getLastCommentPattern(card: IssueCard, pattern: string): string {
    if (!card.comments) {
        return '';
    }

    let re = new RegExp(pattern);
    let comment = card.comments.filter((comment) => comment.body.match(re)).pop();
    
    return comment ? new Date(comment["updated_at"]).toDateString() : '';
}

//
// filter cards by label
//
export function filterByLabel(cards: IssueCard[], name: string): IssueCard[] {
    return cards.filter((card) => card.labels.findIndex(label => label.name === name) >= 0);
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