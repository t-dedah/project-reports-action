const { Octokit } = require('@octokit/rest');
import * as cache from './cache'
import * as url from 'url' 
import {ProjectsData, ProjectData} from './interfaces'

function getCacheKey(projUrl: string) {
    let purl = new url.URL(projUrl)
    return purl.pathname.replace(/\//g, '_');    
}

//
// Issue: We have to go through 6 pages of 100 to get to one github org 
// No way to get project by friendly html url
// e.g. github/900 is actually id 3114877
// cache this so we take a friendly input but do it once.  would be nice to cache for 24 hrs.
//
export async function getProject(token: string, projectHtmlUrl: string): Promise<ProjectData> {
    console.log(`Finding project for ${projectHtmlUrl}`);

    let cached = cache.read(getCacheKey(projectHtmlUrl))
    if (cached) {
        return cached;
    }

    let proj: ProjectData = null;

    const octokit = new Octokit({
        auth: token, 
        previews: ['inertia-preview', 'starfox-preview', 'mockingbird-preview']
    });

    let projUrl = new url.URL(projectHtmlUrl);
    let projParts = projUrl.pathname.split("/").filter(e => e);
    console.log(projParts)
    if (projParts.length !== 4) {
        throw new Error(`Invalid project url: ${projectHtmlUrl}`);
    }

    let projKind = projParts[0];  // orgs or users
    let projOwner = projParts[1]; // orgname or username
    let projId = projParts[3];    // html id
    
    let count = 0;
    let page = 0;
    do {
        ++page;
        console.log(`page: ${page}`)

        let res;

        if (projKind === 'orgs') {
            res = await octokit.projects.listForOrg({
                org: projOwner,
                state: "open",
                per_page: 100,
                page: page
            })
        }
        else if (projKind === 'users') {
            console.log(`listForUser ${projOwner}`)
            res = await octokit.projects.listForUser({
                username: projOwner,
                state: "open",
                per_page: 100,
                page: page
            })            
        }
        else {
            throw new Error(`Invalid project url: ${projectHtmlUrl}`);
        }

        let projects = res.data;
        count = projects.length;

        console.log(`returned ${count}`);

        // projects.forEach((project) => {
        for (const project of projects) {
            if (projectHtmlUrl.indexOf(project.html_url) > -1) {
                proj = <ProjectData>{
                    id: project.id,
                    html_url: project.html_url,
                    name: project.name
                }

                cache.write(getCacheKey(project.html_url), proj);
                console.log(`Found ${project.name}`);
                break;
            }
        }
    } while (count == 100)
    
    return proj;
    //octokit.search.issuesAndPullRequests("org:github+type:issue+state:open+project:github/900")
}

export async function getColumnsForProject(token: string, project) {
    const octokit = new Octokit({
        auth: token, 
        previews: ['inertia-preview']
    });

    console.log(`Getting columns for ${project.id}`);
    let cols = await octokit.projects.listColumns({project_id: project.id});
    return cols.data;
}

export async function getCardsForColumns(token: string, colId: number, colName: string) {
    const octokit = new Octokit({
        auth: token, 
        previews: ['inertia-preview']
    });

    let cards = await octokit.projects.listCards({column_id: colId});
    cache.write("cards-" + colName, cards);
    return cards;
}
