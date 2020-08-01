import * as os from 'os';

const reportType = 'any';
export {reportType};

export function getDefaultConfiguration(): any {
    return <any>{
        "add-age": 'days'
    };
}

// processing the data does a js map on each items and adds data that the report rendering (generate) needs
// we will dump the json data used to generate the reports next to the rendered report 
// e.g. this function should look at the transition times and added wip status of yellow, red etc. 
export function process(config, data: any): any {
    // TODO: process and add age in hours
    if (config) {
        return data;    
    }
    return data;
}

export function renderMarkdown(projectData, data: any): string {
    let lines: string[] = []
    lines.push(`## Echo data `);

    if (projectData) {
        lines.push("");
        lines.push("```javascript")
        lines.push(JSON.stringify(projectData, null, 2));
        lines.push("```");        
    }

    lines.push("");
    lines.push("```javascript")
    lines.push(JSON.stringify(data, null, 2));
    lines.push("```");
    // TODO

    return lines.join(os.EOL);
}

export function renderHtml(): string {
    // Not supported yet
    return "";
}