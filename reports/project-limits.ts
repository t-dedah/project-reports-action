import {ProjectData, ProjectIssue} from '../interfaces';
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
        // Epic for now.  Supports others. 
        // Will appear on report in this casing but matches labels with lowercase version.
        "report-on-label": 'Epic',
        "proposed-limit": 0,  
        "accepted-limit": 0,
        "in-progress-limit": 4,
        "done-limt": 0,
        "count-label-match": "(\\d+)-wip"
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

export interface WipData { 
    cardType: string,
    data: {[key: string]: WipStageData}
}

//export type WipStage = { [key: string]: WipStageData }
export interface WipStageData {
    flag: boolean,
    wips: number, 
    limit: number, 
    // items that matched so possible to do drill in later
    items: IssueCardEx[]    
}
export interface IssueCardEx extends ProjectIssue {
    wips: number;
}

function getDrillName(cardType: string, stage: string): string {
    return `limits-${cardType}-${stage}`.replace(" ", "-");
}
export function process(config: any, projData: ProjectData, drillIn: (identifier: string, title: string, cards: ProjectIssue[]) => void): any {
    let wipData = <WipData>{};
    wipData.data = {};

    // epic, etc..
    wipData.cardType = config["report-on-label"];

    // proposed, in-progress, etc...
    for (let stage in projData.stages) {
        let stageData = <WipStageData>{};

        let cards = projData.stages[stage];
        let cardsForType = wipData.cardType === '*'? clone(cards) : clone(rptLib.filterByLabel(cards, wipData.cardType.toLowerCase()) as IssueCardEx[]);

        drillIn(getDrillName(wipData.cardType, stage), `Issues for ${stage} ${wipData.cardType}s`, cardsForType);

        // add wip number to each card from the wip label
        cardsForType.map((card: IssueCardEx) => {
            card.wips = rptLib.getCountFromLabel(card, new RegExp(config["count-label-match"]));
            return card;
        })

        stageData.wips = rptLib.sumCardProperty(cardsForType, "wips");

        let limitKey = `${stage.toLocaleLowerCase()}-limit`;
        stageData.limit = config[limitKey] || 0;
        stageData.flag = stageData.limit > -1 && stageData.wips > stageData.limit;

        wipData.data[stage] = stageData;    
    }

    return wipData;
}

interface WipRow {
    stage: string,
    limit: string,
    count: string,
}

export function renderMarkdown(projData: ProjectData, processedData: any): string {
    let wipData = processedData as WipData;
    let lines: string[] = [];

    // create a report for each type.  e.g. "Epic"
    let typeLabel = wipData.cardType === '*'? "": wipData.cardType;
    lines.push(`## :ship: ${typeLabel} Limits  `);

    let rows: WipRow[] = [];
    for (let stageName in wipData.data) {
        let wipStage = wipData.data[stageName];
        let wipRow = <WipRow>{};
        wipRow.stage = stageName;
        // data folder is part of the contract here.  make a lib function to create this path
        wipRow.count = `[${wipStage.wips}](./${getDrillName(wipData.cardType, stageName)}.md)`;
        if (wipStage.flag) {
            wipRow.count += "  :triangular_flag_on_post:";
        }
        wipRow.limit = wipStage.limit >= 0 ? wipStage.limit.toString() : "";
        rows.push(wipRow);
    }

    let table: string = tablemark(rows);
    lines.push(table);

    return lines.join(os.EOL);
}

export function renderHtml(): string {
    // Not supported yet
    return "";
}


