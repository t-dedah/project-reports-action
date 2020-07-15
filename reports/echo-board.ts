import {ProjectsData} from '../interfaces'

export function getDefaultConfiguration(): any {
    return <any>{
        "add-age": 'days'
    };
}

export function process(data: ProjectsData): ProjectsData {
    // TODO: process and add age in hours
    return data;
}

export function generate(data: ProjectsData): string {

    return "";
}