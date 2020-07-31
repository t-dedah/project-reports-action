import * as path from 'path'
import * as fs from 'fs'
import * as util from './util'
import * as yaml from 'js-yaml'
import {GitHubClient} from './github'
import * as os from 'os';
import * as mustache from 'mustache'
import * as drillInRpt from './reports/drill-in'
import * as cp from 'child_process';
import {ProjectCrawler} from './projectCrawler';
import {CrawlingConfig, CrawlingTarget} from './interfaces';

let sanitize = require('sanitize-filename');
let clone = require('clone');

import { GeneratorConfiguration, IssueCard, IssueCardEvent, ReportSnapshot, ReportConfig, ProjectData, ProjectReportBuilder, ReportDetails } from './interfaces'

export async function generate(token: string, configYaml: string): Promise<ReportSnapshot> {
    console.log("Generating reports");

    const workspacePath = process.env["GITHUB_WORKSPACE"];
    if (!workspacePath) {
        throw new Error("GITHUB_WORKSPACE not defined");
    }

    let configPath = path.join(workspacePath, configYaml);
    let cachePath = path.join(workspacePath, "_reports", ".data");

    let config = <GeneratorConfiguration>yaml.load(fs.readFileSync(configPath, 'utf-8'))

    let snapshot = <ReportSnapshot>{};
    snapshot.datetime = new Date();
    snapshot.config = config;
    let d = snapshot.datetime;
    let year = d.getUTCFullYear();
    let month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
    let day = d.getUTCDate().toString().padStart(2, "0");
    let hour = d.getUTCHours().toString().padStart(2, "0");
    let minute = d.getUTCMinutes().toString().padStart(2, "0");
    let dt: string = `${year}-${month}-${day}_${hour}-${minute}`;
    snapshot.datetimeString = dt;  
        
    snapshot.rootPath = path.join(workspacePath, snapshot.config.output);

    // apply defaults
    snapshot.config.output = snapshot.config.output || "_reports";
    await writeSnapshot(snapshot);

    // load up the projects, their columns and all the issue cards + events.
    let github = new GitHubClient(token, cachePath);
    let projectData = <ProjectData>{};
    let crawlCfg: CrawlingConfig;
    if (typeof(config.targets) === 'string') {
        throw new Error('crawl config external files not supported yet');
    }
    else {
        crawlCfg = <CrawlingConfig>config.targets;
    }

    console.log("crawl cfg");
    console.log(JSON.stringify(crawlCfg, null, 2));

    let crawled = 0;
    for (let targetName in crawlCfg) {
        console.log(`target: ${targetName}`);
        let target:CrawlingTarget = crawlCfg[targetName];
        if (target.type === 'project') {
            console.log(`crawling project ${target.htmlUrl}`);
            let projectCrawler = new ProjectCrawler(github);
            await projectCrawler.crawl(target, projectData);
            ++crawled;
        }
        else if (target.type === 'repo') {        
            throw new Error('crawling repos not supported yet');
            //++crawled;
        }
        else {
            throw new Error(`Unsupported target config: ${target.type}`);
        }
    }

    if (crawled == 0) {
        throw new Error("No targets were crawled for data.  Please specify targets in the config file.");
    }

    console.log("data crawled.");

    // update report config details
    for (const report of config.reports) {
        report.timezoneOffset = report.timezoneOffset || -8;

        report.details = <ReportDetails>{
            time: util.getTimeForOffset(snapshot.datetime, report.timezoneOffset)
        }
        report.details.rootPath = path.join(snapshot.rootPath, sanitize(report.name));
        report.details.fullPath = path.join(report.details.rootPath, snapshot.datetimeString);
        report.details.dataPath = path.join(report.details.fullPath, 'data');

        report.title = mustache.render(report.title, {
            config: config,
            report: report
        });
    }


    for (const report of config.reports) {
        let output = "";

        output += getReportHeading(report);
        console.log();
        console.log(`Generating ${report.name} ...`);
        await createReportPath(report);

        for (const reportSection of report.sections) {
            output += `&nbsp;  ${os.EOL}`;

            let reportModule = `${reportSection.name}`;

            // if it's a relative path, find in the workflow repo relative path.
            // this allows for consume of action to create their own report sections
            // else look for built-ins
            console.log(`Report module ${reportModule}`);
            let reportModulePath;

            if (reportModule.startsWith("./")) {
                reportModulePath = path.join(process.env["GITHUB_WORKSPACE"], `${reportModule}`);
            }
            else {
                reportModulePath = path.join(__dirname, `./reports/${reportSection.name}`);
            }

            console.log(`Loading: ${reportModulePath}`);

            if (!fs.existsSync(reportModulePath)) {
                throw new Error(`Report not found: ${reportSection.name}`);
            }

            let reportGenerator = require(reportModulePath) as ProjectReportBuilder;

            // overlay user settings over default settings 
            let config = reportGenerator.getDefaultConfiguration();
            for (let setting in reportSection.config || {}) {
                config[setting] = reportSection.config[setting];
            }

            console.log("Processing data ...")

            let drillIns = [];
            let drillInCb = (identifier: string, title: string, cards: IssueCard[]) => {
                drillIns.push({
                    identifier: identifier,
                    title: title,
                    cards: cards
                })
            }

            let processed = reportGenerator.process(config, clone(projectData), drillInCb);
            await writeSectionData(report, reportModule, config, processed);

            if (report.kind === 'markdown') {
                output += reportGenerator.renderMarkdown(projectData, processed);
                // output += `&nbsp;${os.EOL}`;
            }
            else {
                throw new Error(`Report kind ${report.kind} not supported`);
            }

            for (let drillIn of drillIns) {
                let drillInReport: string;
                if (report.kind === 'markdown') {
                    drillInReport = drillInRpt.renderMarkdown(drillIn.title, clone(drillIn.cards));
                }
                else {
                    throw new Error(`Report kind ${report.kind} not supported`);
                }

                await writeDrillIn(report, drillIn.identifier, drillIn.cards, drillInReport);
            }
        }
        console.log("Writing report");
        writeReport(report, projectData, output);
        console.log("Done.");
    }
    console.log();

    return snapshot;
}

function getReportHeading(report: ReportConfig) {
    let lines: string[] = [];

    if (report.kind === "markdown") {
        lines.push(`# :crystal_ball: ${report.title}  `)
        lines.push('  ');
        lines.push(`Generated with :heart: by [project-reports-action](https://github.com/bryanmacfarlane/project-reports-action)  `);
        lines.push(`<sub><sup>${report.details.time}</sup></sub>  `);
        lines.push("  ");
    }
    
    return lines.join(os.EOL);
}

async function writeDrillIn(report: ReportConfig, identifier: string, cards: IssueCard[], contents: string) {
    console.log(`Writing drill-in data for ${identifier} ...`);
    fs.writeFileSync(path.join(report.details.dataPath, `${identifier}.json`), JSON.stringify(cards, null, 2));
    fs.writeFileSync(path.join(report.details.rootPath, `${identifier}.md`), contents);
    fs.writeFileSync(path.join(report.details.fullPath, `${identifier}.md`), contents);
}

// creates directory structure for the reports and hands back the root path to write reports in
async function writeSnapshot(snapshot: ReportSnapshot) {
    console.log("Writing snapshot data ...");
    const genPath = path.join(snapshot.rootPath, ".data");
    if (!fs.existsSync(genPath)) {
        fs.mkdirSync(genPath, { recursive: true });
    }

    const snapshotPath = path.join(genPath, `${snapshot.datetimeString}.json`);
    console.log(`Writing to ${snapshotPath}`);

    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
}

async function createReportPath(report: ReportConfig) {
    console.log(`Creating report path: ${report.details.fullPath}`);
    if (!fs.existsSync(report.details.fullPath)) {
        fs.mkdirSync(report.details.fullPath, { recursive: true });
    }

    if (!fs.existsSync(report.details.dataPath)) {
        fs.mkdirSync(report.details.dataPath, { recursive: true });
    }    
}

async function writeSectionData(report: ReportConfig, name: string, settings: any, processed: any) {
    console.log(`Writing section data for ${name}...`);
    const sectionPath = path.join(report.details.fullPath, "data", sanitize(name));
    if (!fs.existsSync(sectionPath)) {
        fs.mkdirSync(sectionPath, { recursive: true });
    }

    fs.writeFileSync(path.join(sectionPath, "settings.json"), JSON.stringify(settings, null, 2));
    fs.writeFileSync(path.join(sectionPath, "processed.json"), JSON.stringify(processed, null, 2));
}

async function writeReport(report: ReportConfig, projectData: ProjectData, contents: string) {
    console.log("Writing the report ...");
    fs.writeFileSync(path.join(report.details.rootPath, "_report.md"), contents);
    fs.writeFileSync(path.join(report.details.fullPath, "_report.md"), contents);
    fs.writeFileSync(path.join(report.details.dataPath, "_project.json"), JSON.stringify(projectData, null, 2));
}


