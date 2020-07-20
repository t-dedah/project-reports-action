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
const os = __importStar(require("os"));
function getDefaultConfiguration() {
    return {
        "add-age": 'days'
    };
}
exports.getDefaultConfiguration = getDefaultConfiguration;
// processing the data does a js map on each items and adds data that the report rendering (generate) needs
// we will dump the json data used to generate the reports next to the rendered report 
// e.g. this function should look at the transition times and added wip status of yellow, red etc. 
function process(data) {
    // TODO: process and add age in hours
    return data;
}
exports.process = process;
function renderMarkdown(projData) {
    let lines = [];
    lines.push(`## Echo data for ${projData.name}`);
    lines.push("");
    lines.push("### Project Data");
    lines.push("");
    lines.push("```javascript");
    lines.push(JSON.stringify(projData, null, 2));
    lines.push("```");
    // TODO
    return lines.join(os.EOL);
}
exports.renderMarkdown = renderMarkdown;
function renderHtml() {
    // Not supported yet
    return "";
}
exports.renderHtml = renderHtml;
