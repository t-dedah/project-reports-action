import * as mustache from 'mustache';
import * as fs from 'fs';
import * as path from 'path';


// {
//     "method": "GET",
//     "baseUrl": "https://api.github.com",
//     "headers": {
//       "accept": "application/vnd.github.v3+json",
//       "user-agent": "octokit-rest.js/18.0.0 octokit-core.js/3.1.0 Node.js/12.16.2 (macOS Catalina; x64)"
//     },
//     "mediaType": {
//       "format": "",
//       "previews": [
//         "starfox",
//         "sailor-v"
//       ]
//     },
//     "request": {},
//     "url": "/repos/{owner}/{repo}/issues/{issue_number}",
//     "owner": "bryanmacfarlane",
//     "repo": "quotes-feed",
//     "issue_number": "6"
//   } 

export interface IStore {
    // check in cache, if so, return etag
    check (options): Promise<string>,
    read (request, options): Promise<any>;
    write (response, options): Promise<void>;
}

export class FileSystemStore implements IStore {
    _path: string;

    constructor(path: string) {
        this._path = path;
    }

    private getCachePath(options): string {
        let urlFormat = options.url.replace(new RegExp('{', 'g'), '{{{').replace(new RegExp('}', 'g'), '}}}');
        // console.log(urlFormat);
        let urlPath = mustache.render(urlFormat, options);
        // console.log(`${urlPath}`);
        let cachePath = path.join(this._path, urlPath);
        console.log(`cachePath: ${cachePath}`);
        return cachePath;
    }

    public async check(options): Promise<string> {
        let cachePath = this.getCachePath(options);
        let etagPath = path.join(cachePath, "etag");
        let exists = fs.existsSync(path.join(cachePath, "res.json")) &&
                     fs.existsSync(path.join(cachePath, "etag"));

        let etag: string;
        if (exists) {
            etag = fs.readFileSync(etagPath).toString();
        } 
         
        return etag;
    }

    public async read(response, options):Promise<any> {
        let cachePath = this.getCachePath(options);
        console.log(`reading ${cachePath} ...`);

        // TODO: async
        let contents = fs.readFileSync(path.join(cachePath, "res.json")).toString();
        return JSON.parse(contents);
    } 

    public async write(response, options):Promise<void> {
        let cachePath = this.getCachePath(options);

        // TODO: async
        fs.mkdirSync(cachePath, {recursive: true});

        // TODO: always overwrite
        fs.writeFileSync(path.join(cachePath, "res.json"), JSON.stringify(response, null, 2));
        fs.writeFileSync(path.join(cachePath, "etag"), response.headers.etag);
        
        return;
    }   
}

export function wrap(store: IStore) {
    return async(request, options) => {
        console.log("\nWrap");

        // only cache GET requests
        if (options.method !== 'GET') {
            return request;
        }

        let res: any;
        let etag = await store.check(options);

        //-H'If-None-Match: "d8bc8195c7b6cf52f49f20e1cfd473dc"'
        if (etag) {
            console.log("cache hit!");
            options.headers["If-None-Match"] = etag; 
        }

        // make the request.
        let response;
        let fromCache = false;
        try {
            response = await request(options);
        }
        catch (err) {
            if (err.status === 304 && etag) {
                console.log("content hasn't changed. return from cache");
                response = await store.read(request, options);
                fromCache = true;
            }
            else {
                throw err;
            }
        }

        // if etag and 304 Not Modified, read from disk
        if (!fromCache) {
            await store.write(response, options);
            console.log(`Written to cache`);
        }

        console.log(`rate limit     : ${response.headers["x-ratelimit-limit"]}`);
        console.log(`rate remaining : ${response.headers["x-ratelimit-remaining"]}`);

        return response;
    }
};