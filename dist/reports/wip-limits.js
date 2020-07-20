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
exports.renderHtml = exports.renderMarkdown = exports.process = exports.getDefaultConfiguration = void 0;
const rptLib = __importStar(require("./project-reports-lib"));
const tablemark = require('tablemark');
const os = __importStar(require("os"));
/*
 * Gives visibility into whether the team has untriaged debt, an approval bottleneck and
 * how focused the team is (e.g. how many efforts are going on)
 * A wip is a work in progress unit of resourcing.  e.g. it may be one developer or it might mean 4 developers.
 */
function getDefaultConfiguration() {
    return {
        // Epic for now.  Supports others. 
        // Will appear on report in this casing but matches labels with lowercase version.
        "report-on": ['Epic'],
        "epic-proposed": 2,
        "epic-accepted": 10,
        "epic-in-progress": 4,
        "epic-done": 25,
        "label-match": "(\\d+)-wip"
    };
}
exports.getDefaultConfiguration = getDefaultConfiguration;
function process(config, projData, drillIn) {
    let wipData = {};
    // epic, etc..
    for (let cardType of config["report-on"]) {
        let wipStage = {};
        // proposed, in-progress, etc...
        for (let stage in projData.stages) {
            let stageData = {};
            let cards = projData.stages[stage];
            let cardsForType = rptLib.cardsWithLabel(cards, cardType);
            drillIn(`wip-${cardType}-${stage}`, `Issues for ${stage} ${cardType}s`, cardsForType);
            // add wip number to each card from the wip label
            cardsForType.map((card) => {
                card.wips = rptLib.getCountFromLabel(card, new RegExp(config["label-match"]));
                return card;
            });
            stageData.wips = rptLib.sumCardProperty(cardsForType, "wips");
            let limitKey = `${cardType.toLocaleLowerCase()}-${stage.toLocaleLowerCase()}`;
            stageData.limit = config[limitKey] || 0;
            stageData.flag = stageData.limit > 0 && stageData.wips > stageData.limit;
            wipStage[stage] = stageData;
        }
        wipData[cardType] = wipStage;
    }
    return wipData;
}
exports.process = process;
function renderMarkdown(projData, processedData) {
    let wipData = processedData;
    let lines = [];
    // console.log(JSON.stringify(processedData, null, 2));
    // console.log(`Creating Wip-Limits for ${projData.name}`);
    lines.push(`## Wip Limits`);
    // create a report for each type.  e.g. "Epic"
    for (let cardType in wipData) {
        lines.push(`### ${cardType} WIP limits`);
        let rows = [];
        for (let stageName in wipData[cardType]) {
            let wipStage = wipData[cardType][stageName];
            let wipRow = {};
            wipRow.stage = stageName;
            wipRow.count = `[${wipStage.wips}](./wip-${cardType}-${stageName}/cards.md)`;
            wipRow.limit = wipStage.limit > 0 ? wipStage.limit.toString() : "";
            wipRow.flag = wipStage.flag ? "🥵" : "";
            rows.push(wipRow);
        }
        let table = tablemark(rows);
        lines.push(table);
    }
    return lines.join(os.EOL);
}
exports.renderMarkdown = renderMarkdown;
function renderHtml() {
    // Not supported yet
    return "";
}
exports.renderHtml = renderHtml;
