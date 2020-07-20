import {IssueCard} from '../interfaces';

// TODO: separate npm module.  for now it's a file till we flush out

//
// filter cards by label case insensitive
//
export function cardsWithLabel(cards: IssueCard[], label: string): IssueCard[] {
    // make all the labels lower case
    let filtered = cards.filter((card) => { 
        card.labels = card.labels.map((label) => { return label.toLowerCase()});
        return card.labels.indexOf(label.toLocaleLowerCase()) >= 0;
    }); 

    return filtered;
}

//
// Get number from a label by regex.  
// e.g. get 2 from label "2-wip", new RegExp("(\\d+)-wip")
// returns NaN if no labels match
//
export function getCountFromLabel(card: IssueCard, re: RegExp): number {
    let num = NaN;

    for (let label of card.labels) {
        let matches = label.match(re);
        if (matches && matches.length > 0) {
             num = parseInt(matches[1])
             if (num) {
                 break;
             }
        }
    }
    return num;
}

export function sumCardProperty(cards: IssueCard[], prop: string): number {
    return cards.reduce((a, b) => a + (b[prop] || 0), 0);
}