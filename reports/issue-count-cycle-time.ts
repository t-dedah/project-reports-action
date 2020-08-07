import {ProjectData, ProjectIssue, IssueCardEventProject} from '../interfaces';
import * as rptLib from '../project-reports-lib';
const tablemark = require('tablemark')
import * as os from 'os';

const reportType = 'project';
export {reportType};

export type CycleTimeData = { [key: string]: CycleTimeStageData }
interface CycleTimeStageData {
  title: string,
  cycletime: number,
  limit: number,
  count: number,
  flag: boolean
}

interface CycleTimeRow {
    labels: string,
    count: number,
    cycleTimeInDays: string,
    limit: number
}

export interface IssueCardCycleTime extends ProjectIssue {
  cycletime: number
}

export function getDefaultConfiguration(): any {
    return <any>{
      "report-on-label": ["feature", "epic" ],
      "feature-cycletime-limit": 0,
      "epic-cycletime-limit": 1
    };
}

export function process(config: any, issues: ProjectIssue[], drillIn: (identifier: string, title: string, cards: ProjectIssue[]) => void): any {
  let cycleTimeData = <CycleTimeData>{};
  // merge defaults and overriden config.
  config = Object.assign({}, getDefaultConfiguration(), config);
  let projData: rptLib.ProjectStageIssues = rptLib.getProjectStageIssues(issues);
  for (let cardType of config["report-on-label"]) {
      let stageData = <CycleTimeStageData>{};
      let cards = projData["Done"];
      
      let cardsForType = rptLib.filterByLabel(cards, cardType.toLowerCase());
      // add cycle time to each card in this type.
      cardsForType.map((card: IssueCardCycleTime) => {
          card.cycletime = calculateCycleTime(card);
          return card;
      });

      stageData.title = cardType;
      stageData.count = cardsForType.length;
      stageData.cycletime = cardsForType.reduce((a, b) => a + (b["cycletime"] || 0), 0);

      let limitKey = `${cardType.toLocaleLowerCase().replace(/\s/g , "-")}-cycletime-limit`;
      stageData.limit = config[limitKey] || 0;
      stageData.flag = stageData.limit > -1 && stageData.cycletime > stageData.limit;
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
    ctRow.labels = `\`${cardType}\``;
    ctRow.count = stageData.count;
    ctRow.cycleTimeInDays = ` ${stageData.cycletime.toFixed(2)} ${stageData.flag ? ":triangular_flag_on_post:": ""}`;
    ctRow.limit = stageData.limit;
    rows.push(ctRow);
  }

  let table: string = tablemark(rows);
  lines.push(table);
  return lines.join(os.EOL);
}

//
// Calculate cycle time for a card
// The time, in days, a unit of work spends between the first day it is actively being worked on until the day it is closed.
// In this case, since a project card has events, we look for the event that moved or added a card to the "Accepted" column
// and subtract it from the time that the card moved to the `Done` column.
//
function calculateCycleTime(card: ProjectIssue): number {
    // cycle time starts at Accepted, ends at Done.
    let accepted_time:Date = new Date(card.project_added_at);
    let done_time:Date = new Date(card.project_done_at);

    if (accepted_time == null || done_time == null) {
        return 0;
    }

    return rptLib.diffDays(accepted_time, done_time);
}