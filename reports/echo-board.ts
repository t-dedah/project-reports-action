import {ProjectData} from '../interfaces'
import { listeners } from 'process';
import * as os from 'os';

export function getDefaultConfiguration(): any {
    return <any>{
        "add-age": 'days'
    };
}

// processing the data does a js map on each items and adds data that the report rendering (generate) needs
// we will dump the json data used to generate the reports next to the rendered report 
// e.g. this function should look at the transition times and added wip status of yellow, red etc. 
export function process(data: ProjectData): ProjectData {
    // TODO: process and add age in hours
    return data;
}

export function renderMarkdown(projData: ProjectData): string {
    let lines: string[] = []
    lines.push(`## Echo data for ${projData.name}`);

    lines.push("")
    lines.push("### Project Data");
    lines.push("");
    lines.push("```javascript")
    lines.push(JSON.stringify(projData, null, 2));
    lines.push("```");
    // TODO

    return lines.join(os.EOL);
}

export function renderHtml(): string {
    // Not supported yet
    return "";
}