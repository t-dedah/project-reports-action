import * as fs from 'fs'

export function getTimeForOffset(date: Date, offset: number) {
    var utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    var nd = new Date(utc + (3600000*offset));
    return nd.toLocaleString();
}

export function mkdirP(tgtPath: string) {
    if (!fs.existsSync(tgtPath)) {
        fs.mkdirSync(tgtPath, { recursive: true });
    }    
}