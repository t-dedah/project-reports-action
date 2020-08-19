import {CrawlingTarget} from '../interfaces';
import * as rptLib from '../project-reports-lib';
import {ProjectIssue, IssueList, ProjectStageIssues} from '../project-reports-lib';
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
        // Epic for now.  Supports others. 
        // Will appear on report in this casing but matches labels with lowercase version.
        "report-on-label": 'Feature',
        "proposed-limit": 0,  
        "accepted-limit": 0,
        "in-progress-limit": 4,
        "done-limit": -1
    };
}

//
// Builds a reporting structure of type with stages:
//
// <WipData>{
//      cardType: 'Epic'    
//      data: <WipStage>{
//         "Proposed" : <WipStageData>{
//             flag: true,
//             items: <IssueCardEx[]>[]
//         }
//     }
// }

export interface LimitsData { 
    cardType: string,
    data: {[key: string]: StageData}
}

//export type WipStage = { [key: string]: WipStageData }
export interface StageData {
    flag: boolean,
    limit: number, 
    // items that matched so possible to do drill in later
    items: ProjectIssue[]    
}

function getDrillName(cardType: string, stage: string): string {
    return `limits-${cardType}-${stage}`.split(" ").join("-");
}

export function process(config: any, issueList: IssueList, drillIn: (identifier: string, title: string, cards: ProjectIssue[]) => void): any {
    let limitsData = <LimitsData>{};
    limitsData.data = {};

    // epic, etc..
    limitsData.cardType = config["report-on-label"];

    let issues = issueList.getItems();
    let projData: ProjectStageIssues = rptLib.getProjectStageIssues(issues);

    // proposed, in-progress, etc...
    for (let stage in projData) {
        let stageData = <StageData>{};

        let cards = projData[stage];
        let cardsForType = limitsData.cardType === '*'? clone(cards) : clone(rptLib.filterByLabel(cards, limitsData.cardType.toLowerCase()) as ProjectIssue[]);
        stageData.items = cardsForType;

        drillIn(getDrillName(limitsData.cardType, stage), `Issues for ${stage} ${limitsData.cardType}s`, cardsForType);

        let limitKey = `${stage.toLocaleLowerCase()}-limit`;
        stageData.limit = config[limitKey] || 0;
        stageData.flag = stageData.limit > -1 && cardsForType.length > stageData.limit;
        
        limitsData.data[stage] = stageData;    
    }

    return limitsData;
}

interface StageRow {
    stage: string,
    limit: string,
    count: string,
}

export function renderMarkdown(targets: CrawlingTarget[], processedData: any): string {
    console.log(`Rendering for ${targets.length} targets`);

    let stageData = processedData as LimitsData;
    let lines: string[] = [];

    // create a report for each type.  e.g. "Epic"
    let typeLabel = stageData.cardType === '*'? "": stageData.cardType;
    lines.push(`## :ship: ${typeLabel} Limits  `);

    let rows: StageRow[] = [];
    for (let stageName in stageData.data) {
        let stage = stageData.data[stageName];
        let stageRow = <StageRow>{};
        stageRow.stage = stageName;
        // data folder is part of the contract here.  make a lib function to create this path
        stageRow.count = `[${stage.items.length}](./${getDrillName(stageData.cardType, stageName)}.md)`;
        if (stage.flag) {
            stageRow.count += "  :triangular_flag_on_post:";
        }
        stageRow.limit = stage.limit >= 0 ? stage.limit.toString() : "";
        rows.push(stageRow);
    }

    let table: string = tablemark(rows);
    lines.push(table);

    return lines.join(os.EOL);
}

export function renderHtml(): string {
    // Not supported yet
    return "";
}


