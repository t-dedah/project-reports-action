const { Octokit } = require('@octokit/rest');
import * as cache from './cache'
import * as url from 'url' 
import {ProjectsData, ProjectData, IssueCard, IssueCardEvent, IssueUser} from './interfaces'

function getCacheKey(srcurl: string) {
    let purl = new url.URL(srcurl)
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
    return cards.data;
}

function DateOrNull(date: string): Date {
    return date ? new Date(date) : null;
}

// returns null if not an issue
export async function getIssueCard(token: string, card:any, projectId: number): Promise<IssueCard> {
    if (!card.content_url) {
        return null;
    }

    let cached = cache.read(getCacheKey(card.content_url))
    if (cached) {
        return cached;
    }

    let cardUrl = new url.URL(card.content_url);
    let cardParts = cardUrl.pathname.split('/').filter(e => e);

    const octokit = new Octokit({
        auth: token, 
        previews: ['starfox-preview', 'sailor-v-preview']
    });

    // /repos/:owner/:repo/issues/events/:event_id
    // https://api.github.com/repos/bryanmacfarlane/quotes-feed/issues/9

    let owner = cardParts[1];
    let repo = cardParts[2];
    let issue_number = cardParts[4];

    let issueCard = <IssueCard>{};

    let res = await octokit.issues.get({
        owner: owner,
        repo: repo,
        issue_number: issue_number
    });
    let issue = res.data;

    issueCard.title =  issue.title;
    issueCard.number = issue.number;
    issueCard.html_url = issue.html_url;
    issueCard.closed_at = DateOrNull(issue.closed_at);
    issueCard.created_at = DateOrNull(issue.created_at);
    issueCard.updated_at = DateOrNull(issue.updated_at);
         
    if (issue.assignee) {
        issueCard.assignee = <IssueUser>{
            login: issue.assignee.login,
            id: issue.assignee.id,
            avatar_url: issue.assignee.avatar_url,
            url: issue.assignee.url,
            html_url: issue.assignee.html_url        
        }
    }

    issueCard.labels = [];
    for (const label of issue.labels) {
        issueCard.labels.push(label.name);
    }

    // TODO: paginate
    res = await octokit.issues.listEvents({
        owner: owner,
        repo: repo,
        issue_number: issue_number,
        per_page: 100
    });

    issueCard.events = [];
    // console.log(res.data);
    for (const cardEvent of res.data) {
        let newEvent = <IssueCardEvent>{
            event: cardEvent.event,
            created: new Date(cardEvent.created_at)
        };

        // "event": "added_to_project",
        // "created_at": "2020-07-08T16:51:02Z",
        // "project_card": {
        //   "project_id": 3125939,
        //   "column_name": "..."        
        if ((cardEvent.event === "added_to_project" || 
             cardEvent.event === "converted_note_to_issue" ||
             cardEvent.event === "moved_columns_in_project")) {

            newEvent.data = {
                column_name: cardEvent.project_card.column_name,

                // Watch out!
                // since an issue can belong to multiple boards and issues are cached, we have to add this project_id.
                // when the projectData structure is build, it will conveniently strip out column events that aren't part of the project being processed
                project_id: cardEvent.project_card.project_id
            }

            if (cardEvent.project_card.previous_column_name) {
                newEvent.data.previous_column_name = cardEvent.project_card.previous_column_name;
            }

            issueCard.events.push(newEvent);
        }      
        // "event": "assigned",
        // "created_at": "2020-07-08T16:51:02Z",
        // "assignee": {
        //   "login": "bob",
        //   "html_url": "https://github.com/bob",            
        else if (cardEvent.event === "assigned") {
            newEvent.data = {
                login: cardEvent.assignee.login,
                html_url: cardEvent.assignee.html_url
            }
            issueCard.events.push(newEvent);
        }
        // "event": "labeled",
        // "created_at": "2020-07-07T18:30:36Z",
        // "label": {
        //   "name": "needs-triage",
        else if (cardEvent.event === "labeled") {
            newEvent.data = {
                name: cardEvent.label.name
            }
            issueCard.events.push(newEvent);
        }
        else if (cardEvent.event === "unlabeled") {
            newEvent.data = {
                name: cardEvent.label.name
            }
            issueCard.events.push(newEvent);
        }
        else {
            newEvent.data = {}
            issueCard.events.push(newEvent);
        }                        
    }

    //TODO: sort ascending by date so it's a good historical view

    cache.write(getCacheKey(card.content_url), issueCard);
    return issueCard;
}
