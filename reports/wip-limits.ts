import {ProjectData} from '../interfaces';
import * as os from 'os';

export function getDefaultConfiguration(): any {
    return <any>{
        "active-limit": 2,
        "triage-limit": 10
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

export function render(projData: ProjectData): string {
    let lines: string[] = []
    lines.push(`# Echo data for ${projData.name}`);

    // TODO: write useful report :)
    lines.push("🔴 🟠 🟡 🟢 🔵");

    return lines.join(os.EOL);
}


