import * as fs from 'fs'
import * as path from 'path'

// cleaned up by runner after each job
const cacheDir = process.env['RUNNER_TEMP'];

export function write(name: string, item: any) {
    if (cacheDir && fs.existsSync(cacheDir)) {
        fs.writeFileSync(path.join(cacheDir, name + ".json"), JSON.stringify(item, null, 2))
    }
}

export function read(name: string) {
    let item = null;

    if (cacheDir) {
        let itemPath = path.join(cacheDir, name + ".json");
        if (fs.existsSync(itemPath)) {
            item = JSON.parse((fs.readFileSync(itemPath).toString()));
        }
    }

    return item;
}