"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.render = exports.process = exports.getDefaultConfiguration = void 0;
const os = __importStar(require("os"));
function getDefaultConfiguration() {
    return {
        "wip-limits": {
            "New": 2,
            "Ready for Triage": 10,
            "Ready for Work": 4,
            "Active": 2,
            "Complete": 20,
            "Blocked": 3
        }
    };
}
exports.getDefaultConfiguration = getDefaultConfiguration;
var limitStatus;
(function (limitStatus) {
    limitStatus[limitStatus["OK"] = 1] = "OK";
    limitStatus[limitStatus["Warning"] = 2] = "Warning";
    limitStatus[limitStatus["Error"] = 3] = "Error";
})(limitStatus || (limitStatus = {}));
// write a table using.  see the example on stringifying the check emoji - we can do the colored circle emoji
// https://github.com/citycide/tablemark
// processing the data does a js map on each items and adds data that the report rendering (generate) needs
// we will dump the json data used to generate the reports next to the rendered report 
// e.g. this function should look at the transition times and added wip status of yellow, red etc. 
function process(projData) {
    let report = {
        name: projData.name,
        stages: {}
    };
    const config = getDefaultConfiguration();
    for (let stage in projData.stages) {
        report.stages[stage] = {
            count: projData.stages[stage].length,
            limit: config["wip-limits"][stage],
            limitStatus: getWipLimitStatus(config["wip-limits"][stage], projData.stages[stage].length)
        };
    }
    return report;
}
exports.process = process;
function getWipLimitStatus(limit, actual) {
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
function getWipViolationIcon(status) {
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
function render(reportData) {
    const wipLimitsReport = reportData;
    let lines = [];
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
        wipViolationRow += `${getWipViolationIcon(lineItem.limitStatus)} |`;
        wipLimitsRow += `${lineItem.limit}|`;
    }
    lines.push(columnHeader);
    lines.push(columnHeaderSeparatorRow);
    lines.push(dataRow);
    lines.push(wipViolationRow);
    lines.push(wipLimitsRow);
    return lines.join(os.EOL);
}
exports.render = render;
