import {ProjectData, IssueCard} from '../interfaces';
import * as rptLib from '../project-reports-lib';
const tablemark = require('tablemark')
import * as os from 'os';

export type CycleTimeData = { [key: string]: CycleTimeStageData }
interface CycleTimeStageData {
  title: string,
  cycletime: number,
  limit: number,
  count: number,
  flag: boolean
}

interface CycleTimeRow {
    worktype: string,
    labels: string,
    count: number,
    "Cycle Time in days": string,
    limit: number
    flag: string
}

export interface IssueCardCycleTime extends IssueCard {
  cycletime: number
}

export function getDefaultConfiguration(): any {
    return <any>{};
}

export function process(config: any, projData: ProjectData, drillIn: (identifier: string, title: string, cards: IssueCard[]) => void): any {
  let cycleTimeData = <CycleTimeData>{};
  for (let cardType of config["report-on"]) {
      let stageData = <CycleTimeStageData>{};
      let cards = projData.stages["Done"];
      console.log(`Found [${cards.length}] cards in Done state`);
      let cardsForType = rptLib.filterByLabel(cards, cardType.toLowerCase());

      console.log(`cardsForType is ${cardsForType.length}`);

      // add cycle time to each card in this type.
      cards.map((card: IssueCardCycleTime) => {
          card.cycletime = rptLib.calculateCycleTime(card);
          return card;
      });
      stageData.title = cardType;
      stageData.count = cards.length;
      stageData.cycletime = rptLib.sumCardProperty(cardsForType, "cycletime");
      let limitKey = `${cardType.toLocaleLowerCase()}-cycletime-limit`;
      stageData.limit = config[limitKey] || 0;
      stageData.flag = stageData.limit > 0 && stageData.cycletime > stageData.limit;
      cycleTimeData[cardType] = stageData;
  }

  return cycleTimeData;
}

export function renderMarkdown(projData: ProjectData, processedData: any): string {
  let cycleTimeData = processedData as CycleTimeData;
  let lines: string[] = [];
  let rows: CycleTimeRow[] = [];

  lines.push(`## Issue Count & Cycle Time `);
  for (let cardType in cycleTimeData) {
    const stageData = cycleTimeData[cardType];
    let ctRow = <CycleTimeRow>{};

    ctRow.worktype = cardType;

    ctRow.labels = `\`${cardType}\``;
    ctRow.count = stageData.count;
    ctRow["Cycle Time in days"] = stageData.cycletime.toPrecision(4);
    ctRow.limit = stageData.limit;
    ctRow.flag = stageData.flag ? ":triangular_flag_on_post:": "";

    rows.push(ctRow);
  }

  let table: string = tablemark(rows);
  lines.push(table);
  return lines.join(os.EOL);
}
