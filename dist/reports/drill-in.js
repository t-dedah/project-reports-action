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
exports.renderHtml = exports.renderMarkdown = void 0;
//const tablemark = require('tablemark')
const os = __importStar(require("os"));
function renderMarkdown(heading, cards) {
    let lines = [];
    lines.push(`## ${heading}`);
    // create a report for each type.  e.g. "Epic"
    for (let card of cards) {
        // note: the two spaces at the end of markdown strings are intentional for markdown new lines.  don't trim :)
        lines.push(`  `);
        let assigneeHtml = card.assignee ? `<img height="20" width="20" alt="@${card.assignee.login}" src="${card.assignee.avatar_url}"/>` : "";
        // ### <img height="20" width="20" alt="@bryanmacfarlane" src="https://avatars3.githubusercontent.com/u/919564?v=4"/> [Initial Web UI](https://github.com/bryanmacfarlane/quotes-feed/issues/13) 
        // > [@bryanmacfarlane](https://github.com/bryanmacfarlane)  
        //   `1-dev` `epic`        
        lines.push(`### ${assigneeHtml} [${card.title}](${card.html_url})  `);
        let assigneeLink = card.assignee ? `[@${card.assignee.login}](${card.assignee.html_url})  ` : "not assigned  ";
        lines.push(`> ${assigneeLink}`);
        card.labels = card.labels.map((label) => {
            return `\`${label}\``;
        });
        lines.push(`  ${card.labels.join(" ")}`);
    }
    return lines.join(os.EOL);
}
exports.renderMarkdown = renderMarkdown;
function renderHtml() {
    // Not supported yet
    return "";
}
exports.renderHtml = renderHtml;
