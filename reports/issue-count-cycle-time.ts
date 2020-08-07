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
    worktype: string,
    labels: string,
    count: number,
    cycleTimeInDays: string,
    limit: number
    flag: string
}

export interface IssueCardCycleTime extends ProjectIssue {
  cycletime: number
}

export function getDefaultConfiguration(): any {
    return <any>{};
}

export function process(config: any, issues: ProjectIssue[], drillIn: (identifier: string, title: string, cards: ProjectIssue[]) => void): any {
	let cycleTimeData = <CycleTimeData>{};
  let projData: rptLib.ProjectStageIssues = rptLib.getProjectStageIssues(issues);
  for (let cardType of config["report-on"]) {
  		let stageData = <CycleTimeStageData>{};
      let cards = projData["Done"];
      
      let cardsForType = rptLib.filterByLabel(cards, cardType.toLowerCase());
      // add cycle time to each card in this type.
      cards.map((card: IssueCardCycleTime) => {
          card.cycletime = calculateCycleTime(card);
          return card;
      });

      stageData.title = cardType;
      stageData.count = cards.length;
      stageData.cycletime = cardsForType.reduce((a, b) => a + (b["cycletime"] || 0), 0);
      
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
    ctRow.cycleTimeInDays = stageData.cycletime.toPrecision(2);
    ctRow.limit = stageData.limit;
    ctRow.flag = stageData.flag ? ":triangular_flag_on_post:": "";

    rows.push(ctRow);
  }

  let table: string = tablemark(rows);
  lines.push(table);
  return lines.join(os.EOL);
  // return "## Issue Count & Cycle Time ";
}
//
// Calculate cycle time for a card
// The time, in days, a unit of work spends between the first day it is actively being worked on until the day it is closed.
// In this case, since a project card has events, we look for the event that moved or added a card to the "Accepted" column
// and subtract it from the time that the card moved to the `Done` column.
//
function calculateCycleTime(card: ProjectIssue): number {
    // cycle time starts at Accepted, ends at Done.
    let accepted_time:Date = null;
    let done_time:Date = null;
    card.events.forEach((event)=> {
        if (event.event == "added_to_project") {
            if (event.project_card.stage_name == "Accepted") {
                accepted_time = new Date(event.created_at);
            }
        } else if (event.event == "moved_columns_in_project" ) {
            if (event.project_card.stage_name == "Accepted") {
                accepted_time = new Date(event.created_at);
            }
            else if (event.project_card.stage_name == "Done") {
                done_time = new Date(event.created_at);
            }
        }
    });

    if (accepted_time == null || done_time == null) {
        return 0;
    }

    return rptLib.diffDays(accepted_time, done_time);
}