import * as path from 'path'
import * as fs from 'fs'
import * as util from './util'
import * as yaml from 'js-yaml'
import * as url from 'url';
// import {GitHubClient} from './github'
import * as os from 'os';
import * as mustache from 'mustache'
import * as drillInRpt from './reports/drill-in'
import {Crawler} from './crawler';
import * as lib from './project-reports-lib'
import moment = require('moment');

let sanitize = require('sanitize-filename');
let clone = require('clone');

import {IssueList, ProjectIssue} from './project-reports-lib';
import { CrawlingConfig, CrawlingTarget, GeneratorConfiguration, ReportSnapshot, ReportConfig, ProjectReportBuilder, ReportDetails } from './interfaces'

export async function generate(token: string, configYaml: string): Promise<ReportSnapshot> {
    const workspacePath = process.env["GITHUB_WORKSPACE"];
    if (!workspacePath) {
        throw new Error("GITHUB_WORKSPACE not defined");
    }

    let configPath = path.join(workspacePath, configYaml);
    let cachePath = path.join(workspacePath, "_reports", ".data");
    util.mkdirP(cachePath);

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

    snapshot.config.output = snapshot.config.output || "_reports";
    snapshot.rootPath = path.join(workspacePath, snapshot.config.output);

    console.log(`Writing snapshot to ${snapshot.rootPath}`);
    await writeSnapshot(snapshot);

    // update report config details
    for (const report of config.reports) {
        report.timezoneOffset = report.timezoneOffset || -8;

        report.details = <ReportDetails>{
            time: moment().utcOffset(report.timezoneOffset).format("dddd, MMMM Do YYYY, h:mm:ss a")
        }
        report.details.rootPath = path.join(snapshot.rootPath, sanitize(report.name));
        report.details.fullPath = path.join(report.details.rootPath, snapshot.datetimeString);
        report.details.dataPath = path.join(report.details.fullPath, 'data');

        report.title = mustache.render(report.title, {
            config: config,
            report: report
        });
    }

    let crawlCfg: CrawlingConfig;
    if (typeof(config.targets) === 'string') {
        throw new Error('crawl config external files not supported yet');
    }
    else {
        crawlCfg = <CrawlingConfig>config.targets;
    }

    // apply defaults to targets
    console.log("Applying target defaults");
    for (let targetName in crawlCfg) {
        let target = crawlCfg[targetName];
        if (target.type === 'project') {
            if (!target.columnMap) {
                target.columnMap = {};
            }

            let defaultPhases = ['Proposed', 'Accepted', 'In-Progress', 'Done'];
            for (let phase of defaultPhases) {
                if (!target.columnMap[phase]) {
                    target.columnMap[phase] = [ phase ];
                }
            }

            // make sure "In Progress" (default in GH Kanban) is synonymous with In-Progress
            if (target.columnMap['In-Progress'].indexOf('In progress') === -1) {
                target.columnMap['In-Progress'].push('In progress');
            }
        }
    }

    let crawler: Crawler = new Crawler(token, cachePath);

    for (const report of config.reports) {
        let output = "";

        // gather all the markdown files in the root to delete before writing new files
        deleteFilesInPath(report.details.rootPath);

        output += getReportHeading(report);
        console.log();
        console.log(`Generating ${report.name} ...`);
        await createReportPath(report);

        for (const reportSection of report.sections) {

            // We only support rollup of repo issues. 
            // once we move ProjectData to a distinct set, we can support project data as well
            // let projectData: ProjectData = null;

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

            // ----------------------------------------------------------------------
            // Crawl targets data.  
            // definition on section but fall back to report 
            // ----------------------------------------------------------------------
            let targetNames = reportSection.targets || report.targets;

            let set = new IssueList(issue => issue.html_url);
            
            let targets: CrawlingTarget[] = [];
            for (let targetName of targetNames) {
                console.log()
                console.log(`Crawling target: '${targetName}' for report: '${report.name}', section '${reportSection.name}'`)
                console.log('-------------------------------------------------------------------------------')
                let target = crawlCfg[targetName];
                targets.push(target);

                if (reportGenerator.reportType !== "any" && reportGenerator.reportType !== target.type) {
                    throw new Error(`Report target mismatch.  Target is of type ${target.type} but report section is ${reportGenerator.reportType}`);
                }

                let data: ProjectIssue[] = await crawler.crawl(target);
                console.log(`Adding ${data.length} issues to set ...`);
                set.add(data);
            }

            console.log(`Issues set has ${set.getItems().length}`);
            
            console.log("Processing data ...")

            let drillIns = [];
            let drillInCb = (identifier: string, title: string, cards: ProjectIssue[]) => {
                drillIns.push({
                    identifier: identifier,
                    title: title,
                    cards: cards
                })
            }

            let processed = reportGenerator.process(config, clone(set.getItems()), drillInCb);

            await writeSectionData(report, reportModule, config, processed);

            report.kind = report.kind || 'markdown';
            
            if (report.kind === 'markdown') {
                console.log('Rendering markdown ...');
                // let data = reportGenerator.reportType == 'repo' ? targets : projectData;
                output += reportGenerator.renderMarkdown(targets, processed);
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
        writeReport(report, crawler.getTargetData(), output);
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

async function deleteFilesInPath(targetPath: string) {
    console.log();
    let existingRootFiles = fs.readdirSync(targetPath).map( item => path.join(targetPath, item));
    existingRootFiles = existingRootFiles.filter(item => fs.lstatSync(item).isFile());
    for (let file of existingRootFiles) {
        console.log(`cleaning up ${file}`);
        fs.unlinkSync(file);
    }    
}

async function writeDrillIn(report: ReportConfig, identifier: string, cards: ProjectIssue[], contents: string) {
    console.log(`Writing drill-in data for ${identifier} ...`);
    fs.writeFileSync(path.join(report.details.dataPath, `${identifier}.json`), JSON.stringify(cards, null, 2));
    fs.writeFileSync(path.join(report.details.rootPath, `${identifier}.md`), contents);
    fs.writeFileSync(path.join(report.details.fullPath, `${identifier}.md`), contents);
}

// creates directory structure for the reports and hands back the root path to write reports in
async function writeSnapshot(snapshot: ReportSnapshot) {
    console.log("Writing snapshot data ...");
    const genPath = path.join(snapshot.rootPath, ".data");
    util.mkdirP(genPath);

    const snapshotPath = path.join(genPath, `${snapshot.datetimeString}.json`);
    console.log(`Writing to ${snapshotPath}`);

    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
}

async function createReportPath(report: ReportConfig) {
    console.log(`Creating report path: ${report.details.fullPath}`);
    if (!fs.existsSync(report.details.fullPath)) {
        fs.mkdirSync(report.details.fullPath, { recursive: true });
    }

    util.mkdirP(report.details.dataPath);
}

async function writeSectionData(report: ReportConfig, name: string, settings: any, processed: any) {
    console.log(`Writing section data for ${name}...`);
    const sectionPath = path.join(report.details.fullPath, "data", sanitize(name));
    util.mkdirP(sectionPath);

    fs.writeFileSync(path.join(sectionPath, "settings.json"), JSON.stringify(settings, null, 2));
    fs.writeFileSync(path.join(sectionPath, "processed.json"), JSON.stringify(processed, null, 2));
}

async function writeReport(report: ReportConfig, targetData: any, contents: string) {
    console.log("Writing the report ...");
    fs.writeFileSync(path.join(report.details.rootPath, "_report.md"), contents);
    fs.writeFileSync(path.join(report.details.fullPath, "_report.md"), contents);
    for (let target in targetData) {
        let urlPath = url.parse(target).path.split("/").join("_");
        fs.writeFileSync(path.join(report.details.dataPath, `target-${sanitize(urlPath)}.json`), JSON.stringify(targetData[target], null, 2));
    }
    
}


