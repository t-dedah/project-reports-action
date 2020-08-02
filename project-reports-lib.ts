import {ProjectIssue, IssueSummary} from './interfaces';
import * as url from 'url' 

// TODO: separate npm module.  for now it's a file till we flush out

export * from './project-reports-schemes';

export interface RepoProps {
    owner: string,
    repo: string
}

export function repoPropsFromUrl(htmlUrl: string): RepoProps {
    let rUrl = new url.URL(htmlUrl);
    let parts = rUrl.pathname.split('/').filter(e => e);

    return <RepoProps>{
        owner:parts[0],
        repo: parts[1]
    }    
}
//
// filter cards by label
//
export function filterByLabel(issues: IssueSummary[], name: string): IssueSummary[] {
    return issues.filter((card) => card.labels.findIndex(label => label.name.trim().toLowerCase() === name.toLowerCase()) >= 0);
}

//
// Get number from a label by regex.  
// e.g. get 2 from label "2-wip", new RegExp("(\\d+)-wip")
// returns NaN if no labels match
//
export function getCountFromLabel(card: ProjectIssue, re: RegExp): number {
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

export function getStringFromLabel(card: ProjectIssue, re: RegExp): string {
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

export function sumCardProperty(cards: ProjectIssue[], prop: string): number {
    return cards.reduce((a, b) => a + (b[prop] || 0), 0);
}
