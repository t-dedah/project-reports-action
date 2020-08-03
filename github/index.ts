const { Octokit } = require('@octokit/rest');
import * as url from 'url' 
import {ProjectData, ProjectIssue, IssueEvent, IssueSummary, IssueComment, IssueParameters} from '../interfaces'
import * as restCache from './octokit-rest-cache';
import {DistinctSet} from '../util';

function DateOrNull(date: string): Date {
    return date ? new Date(date) : null;
}

export class GitHubClient {
    octokit:any;

    constructor(token: string, cacheDir) {
        this.octokit = new Octokit({
            auth: token, 
            previews: [
                'squirrel-girl-preview', 
                'inertia-preview', 
                'starfox-preview', 
                'mockingbird-preview', 
                'sailor-v-preview'
            ]
        });
    
        let diskCache = new restCache.FileSystemStore(cacheDir);
        this.octokit.hook.wrap("request", restCache.wrap(diskCache));
    }

    public async getProject(projectHtmlUrl: string): Promise<ProjectData> {
        console.log(`Finding project for ${projectHtmlUrl}`);

        let proj: ProjectData = null;
        let projUrl = new url.URL(projectHtmlUrl);
        let projParts = projUrl.pathname.split("/").filter(e => e);
    
        if (projParts.length !== 4) {
            throw new Error(`Invalid project url: ${projectHtmlUrl}`);
        }
    
        let projKind = projParts[0];  // orgs or users
        let projOwner = projParts[1]; // orgname or username
        // let projId = projParts[3];    // html id
        
        let count = 0;
        let page = 0;
        do {
            ++page;
            console.log(`page: ${page}`)
    
            let res;
    
            if (projKind === 'orgs') {
                console.log(`querying: ${projKind}, ${projOwner}`);
                res = await this.octokit.projects.listForOrg({
                    org: projOwner,
                    state: "open",
                    per_page: 100,
                    page: page
                })
            }
            else if (projKind === 'users') {
                console.log(`querying: ${projKind}, ${projOwner}`);
                res = await this.octokit.projects.listForUser({
                    username: projOwner,
                    state: "open",
                    per_page: 100,
                    page: page
                })            
            }
            else {
                // if it's not an org or user project, must be a repo
                let owner = projParts[0]; 
                let repo = projParts[1];
                console.log(`querying for owner:'${owner}', repo:'${repo}'`);
                res = await this.octokit.projects.listForRepo({
                    owner: owner,
                    repo: repo,
                    state: "open",
                    per_page: 100,
                    page: page  
                  });
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
    
                    console.log(`Found ${project.name}`);
                    break;
                }
            }
        } while (count == 100)
        
        return proj;
    }

    public async getColumnsForProject(project): Promise<any> { 
        let cols = await this.octokit.projects.listColumns({project_id: project.id});
        return cols.data;
    }
    
    public async getCardsForColumns(colId: number, colName: string) {    
        let cards = await this.octokit.projects.listCards({column_id: colId});
        return cards.data;
    }
    
    public async getIssueComments(owner: string, repo: string, issue_number: string): Promise<IssueComment[]> {    
        let res = await this.octokit.issues.listComments({
            owner,
            repo,
            issue_number,
            per_page: 100
          });
    
        return res.data;
    } 
    
    // returns null if not an issue
    public async getIssueForCard(card:any, projectId: number): Promise<ProjectIssue> {
        if (!card.content_url) {
            return null;
        }

        let cardUrl = new url.URL(card.content_url);
        let cardParts = cardUrl.pathname.split('/').filter(e => e);

        // /repos/:owner/:repo/issues/events/:event_id
        // https://api.github.com/repos/bryanmacfarlane/quotes-feed/issues/9

        let owner = cardParts[1];
        let repo = cardParts[2];
        let issue_number = cardParts[4];

        let issueCard = <ProjectIssue>{};

        let res = await this.octokit.issues.get({
            owner: owner,
            repo: repo,
            issue_number: issue_number,
            per_page: 100
        });

        //console.log(JSON.stringify(res, null, 2));
        let issue = res.data;

        issueCard.number = issue.number;
        issueCard.title =  issue.title;
        issueCard.number = issue.number;
        issueCard.html_url = issue.html_url;
        issueCard.closed_at = DateOrNull(issue.closed_at);
        issueCard.created_at = DateOrNull(issue.created_at);
        issueCard.updated_at = DateOrNull(issue.updated_at);
        issueCard.assignee = issue.assignee;
        issueCard.assignees = issue.assignees;
        issueCard.labels = issue.labels;

        issueCard.comments = [];
        if (issue.comments > 0) {
            issueCard.comments = await this.getIssueComments(owner, repo, issue_number);
        }
        
        // TODO: paginate?
        res = await this.octokit.issues.listEvents({
            owner: owner,
            repo: repo,
            issue_number: issue_number,
            per_page: 100
        });

        issueCard.events = res.data as IssueEvent[];

        //TODO: sort ascending by date so it's a good historical view

        return issueCard;
    }

    //
    // This will get all open issues unioned with all issues changed in last n days
    // It will sort descending by updated time
    //
    // This focuses on two main scenarios:
    //   1. Slice and dice opened bugs by labels, assigned, milestone
    //   2. Get cycle time (time opened to closed etc.)
    //
    // https://developer.github.com/v3/issues/#parameters-3
    async getIssuesForRepo(repoUrl: string, daysAgo: number = 7): Promise<any[]> {
        let set = new DistinctSet(issue => issue.number);

        let rUrl = new url.URL(repoUrl);
        let parts = rUrl.pathname.split('/').filter(e => e);

        let repoProps = {
            owner:parts[0],
            repo: parts[1]
        }
          
        let opened = await this.octokit.paginate(
            "GET /repos/:owner/:repo/issues",
            {
                ...repoProps,
                state: 'open'
            },
            (response) => response.data.filter(issue => !issue.pull_request)
        );
        console.log(`Found ${opened.length} opened issues`);
        set.add(opened);


        // get Date n days ago as of mindnight (ensures cache hit if you run every 15 min)
        var dateAgo = new Date();
        dateAgo.setHours(0,0,0,0);
        dateAgo.setDate(dateAgo.getDate() - daysAgo);

        console.log(`${daysAgo} days ago is ${dateAgo.toISOString()}`);

        let recentIssues = await this.octokit.paginate(
            "GET /repos/:owner/:repo/issues",
            {
                ...repoProps,
                since: dateAgo.toUTCString()
            },
            (response) => response.data.filter(issue => !issue.pull_request)
        );
        console.log(`Found ${recentIssues.length} issues changed in last ${daysAgo} days.`);
        set.add(recentIssues);

        let issues = set.getItems();
        console.log(`Total of ${issues.length} distinct issues`);

        return issues;
    }
}
