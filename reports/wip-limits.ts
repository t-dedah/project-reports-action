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
        // Epic for now.  Supports others. 
        // Will appear on report in this casing but matches labels with lowercase version.
        "report-on": ['Epic'],
        "epic-proposed": 0,  
        "epic-accepted": 0,
        "epic-in-progress": 4,
        "epic-done": 0,
        "wip-label-match": "(\\d+)-wip"
    };
}

//
// Builds a reporting structure of type with stages:
//
// <WipData>{
//     "epic": <WipStage>{
//         "Proposed" : <WipStageData>{
//             flag: true,
//             items: <IssueCardEx[]>[]
//         }
//     }
// }

export type WipData = { [key: string]: WipStage }
export type WipStage = { [key: string]: WipStageData }
export interface WipStageData {
    flag: boolean,
    wips: number, 
    limit: number, 
    // items that matched so possible to do drill in later
    items: IssueCardEx[]    
}
export interface IssueCardEx extends IssueCard {
    wips: number;
}

export function process(config: any, projData: ProjectData, drillIn: (identifier: string, title: string, cards: IssueCard[]) => void): any {
    let wipData = <WipData>{};

    // epic, etc..
    for (let cardType of config["report-on"]) {
        let reportsOn = config["report-on"];        

        let wipStage = <WipStage>{};

        // proposed, in-progress, etc...
        for (let stage in projData.stages) {
            let stageData = <WipStageData>{};

            let cards = projData.stages[stage];
            let cardsForType = cardType === '*'? clone(cards) : clone(rptLib.filterByLabel(cards, cardType.toLowerCase()) as IssueCardEx[]);

            drillIn(`wip-${cardType}-${stage}`, `Issues for ${stage} ${cardType}s`, cardsForType);

            // add wip number to each card from the wip label
            cardsForType.map((card: IssueCardEx) => {
                card.wips = rptLib.getCountFromLabel(card, new RegExp(config["wip-label-match"]));
                return card;
            })

            stageData.wips = rptLib.sumCardProperty(cardsForType, "wips");

            let limitKey = `${cardType.toLocaleLowerCase()}-${stage.toLocaleLowerCase()}`;
            stageData.limit = config[limitKey] || 0;
            stageData.flag = stageData.limit > -1 && stageData.wips > stageData.limit;

            wipStage[stage] = stageData;    
        }
        
        wipData[cardType] = wipStage;
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
    for (let cardType in wipData) {
        let typeLabel = cardType === '*'? "": cardType;
        lines.push(`## :ship: ${typeLabel} WIP limits  `);

        let rows: WipRow[] = [];
        for (let stageName in wipData[cardType]) {
            let wipStage = wipData[cardType][stageName];
            let wipRow = <WipRow>{};
            wipRow.stage = stageName;
            // data folder is part of the contract here.  make a lib function to create this path
            wipRow.count = `[${wipStage.wips}](./wip-${cardType}-${stageName}.md)`;
            if (wipStage.flag) {
                wipRow.count += "  :triangular_flag_on_post:";
            }
            wipRow.limit = wipStage.limit >= 0 ? wipStage.limit.toString() : "";
            rows.push(wipRow);
        }

        let table: string = tablemark(rows);
        lines.push(table);
    }

    return lines.join(os.EOL);
}

export function renderHtml(): string {
    // Not supported yet
    return "";
}


