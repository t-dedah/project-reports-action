import {ProjectsData} from '../interfaces'

export function getDefaultConfiguration(): any {
    return <any>{
        "active-limit": 2,
        "triage-limit": 10
    };
}

// https://github.com/citycide/tablemark

export function process(data: ProjectsData): ProjectsData {
    // TODO: process and add age in hours
    return data;
}

export function generate(data: ProjectsData): string {
    console.log("🔴 🟠 🟡 🟢 🔵");
    return "";
}


