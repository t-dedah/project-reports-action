import {ProjectData} from '../interfaces';
import * as os from 'os';

export function getDefaultConfiguration(): any {
    return <any>{
        "wip-limits": {
            "New": 2,
            "Ready for Triage": 10,
            "Ready for Work": 4,
            "Active" : 2,
            "Complete": 20,
            "Blocked": 3
        }
    };
}

// write a table using.  see the example on stringifying the check emoji - we can do the colored circle emoji
// https://github.com/citycide/tablemark

// processing the data does a js map on each items and adds data that the report rendering (generate) needs
// we will dump the json data used to generate the reports next to the rendered report 
// e.g. this function should look at the transition times and added wip status of yellow, red etc. 
export function process(data: ProjectData): ProjectData {
    // TODO: process and add age in hours
    return data;
}

function getWipViolationIcon(limit: number, actual: number): string {
    if (actual > limit) {
        return "🔴";
    }

    if (actual == limit) {
        return "🟠";
    }

    if (actual <limit) {
        return "🟢";
    }
}

export function render(projData: ProjectData): string {
    let lines: string[] = []
    let config = getDefaultConfiguration()
    lines.push(`# WIP limits for ${projData.name}`);
    let columnHeader = "|  | ";
    let columnHeaderSeparatorRow = "|:--|";
    let dataRow = "|  |";
    let wipViolationRow = "| Wip Limit status | ";
    let wipLimitsRow = "| Wip Limits | ";
    for (let stage in projData.stages) {

        let wipCount = projData.stages[stage].length;
        columnHeader += `${stage}|`;
        columnHeaderSeparatorRow += ":---|";
        dataRow += `${wipCount}|`;
        wipViolationRow += `${getWipViolationIcon(config["wip-limits"][stage], wipCount)} |`
        wipLimitsRow += `${config["wip-limits"][stage]}|`;
    }

    lines.push(columnHeader);
    lines.push(columnHeaderSeparatorRow);
    lines.push(dataRow);
    lines.push(wipViolationRow)
    lines.push(wipLimitsRow);

    return lines.join(os.EOL);
}


