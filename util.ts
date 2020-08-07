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


export class DistinctSet {
    seen;
    identifer;
    items: any[];

    constructor(identifier: (item) => any) {
        this.seen = new Set();
        this.identifer = identifier;
        this.items = [];
    }

    // returns whether any were added
    public add(data: any | any[]): boolean {
        let added = false;
        if (Array.isArray(data)) {
            for (let item of data) {
                let res = this.add_item(item);
                if (!added) { added = res; }
            }
        }
        else {
            return this.add_item(data);
        }

        return added;
    }

    private add_item(item: any): boolean {
        let id = this.identifer(item);

        if (!this.seen.has(id)) {
            this.items.push(item);
            this.seen.add(id);
            return true;
        }

        return false;
    }

    public getItems(): any[] {
        return this.items;
    }
}