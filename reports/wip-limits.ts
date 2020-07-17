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

enum limitStatus {
    OK = 1,
    Warning,
    Error
}

interface WIPLimitsLineItem {
    count: number,
    limit: number,
    limitStatus: limitStatus
}

interface WIPLimitsReport {
    name: string,
    stages: { [key: string]: WIPLimitsLineItem }
}

// write a table using.  see the example on stringifying the check emoji - we can do the colored circle emoji
// https://github.com/citycide/tablemark

// processing the data does a js map on each items and adds data that the report rendering (generate) needs
// we will dump the json data used to generate the reports next to the rendered report 
// e.g. this function should look at the transition times and added wip status of yellow, red etc. 
export function process(projData: ProjectData): any {
    let report = {
        name: projData.name,
        stages: {}
    };
    const config = getDefaultConfiguration()
    for (let stage in projData.stages) {
        report.stages[stage]= {
            count: projData.stages[stage].length,
            limit: config["wip-limits"][stage],
            limitStatus: getWipLimitStatus(config["wip-limits"][stage], projData.stages[stage].length)
        };
    }

    return report;
}

function getWipLimitStatus(limit: number, actual: number): limitStatus {
    if (actual > limit) {
        return limitStatus.Error;
    }

    if (actual == limit) {
        return limitStatus.Warning;
    }

    if (actual < limit) {
        return limitStatus.OK;
    }

    return limitStatus.Error;
}

function getWipViolationIcon(status: limitStatus): string {
    console.log(`status is ${status}`);
    switch (status) {
        case limitStatus.OK:
            return "🟢";
        case limitStatus.Warning:
            return "🟠";
        case limitStatus.Error:
            return "🔴";
    }
}

export function render(reportData: any): string {
    const wipLimitsReport = reportData as WIPLimitsReport;
    let lines: string[] = []
    let columnHeader = "|  | ";
    let columnHeaderSeparatorRow = "|:--|";
    let dataRow = "|  |";
    let wipViolationRow = "| WIP Limit status | ";
    let wipLimitsRow = "| WIP Limits | ";

    lines.push(`# WIP limits for ${wipLimitsReport.name}`);

    for (const stage in wipLimitsReport.stages) {
        const lineItem = wipLimitsReport.stages[stage];
        columnHeader += `${stage}|`;
        columnHeaderSeparatorRow += ":---|";
        dataRow += `${lineItem.count}|`;
        wipViolationRow += `${getWipViolationIcon(lineItem.limitStatus)} |`
        wipLimitsRow += `${lineItem.limit}|`;
    }

    lines.push(columnHeader);
    lines.push(columnHeaderSeparatorRow);
    lines.push(dataRow);
    lines.push(wipViolationRow)
    lines.push(wipLimitsRow);

    return lines.join(os.EOL);
}


