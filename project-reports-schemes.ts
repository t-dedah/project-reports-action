import {ProjectIssue} from './interfaces';

export function dataFromCard(card: ProjectIssue, filterBy: string, data: string): any {
    
    let fn = module.exports[`get${filterBy}`];
    if (!fn) { 
        throw new Error(`Invalid filter: ${filterBy}`); 
    }

    return fn(card, data);
}

//
// returns hours since last comment with a body matching a pattern
//
export function getLastCommentPattern(card: ProjectIssue, pattern: string): any {
    if (!card.comments) {
        return '';
    }

    let re = new RegExp(pattern);
    let comment = card.comments.filter((comment) => comment.body.match(re)).pop();
    
    return comment ? diffHours(new Date(comment["updated_at"]), new Date()) : -1;
}

export function diffHours(date1: Date, date2: Date): number {
    return Math.abs(date1.getTime() - date2.getTime()) / (60*60*1000);
}