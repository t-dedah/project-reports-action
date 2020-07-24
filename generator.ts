import * as path from 'path'
import * as fs from 'fs'
import * as util from './util'
import * as yaml from 'js-yaml'
import {GitHubClient} from './github'
import * as os from 'os';
import * as mustache from 'mustache'
import * as drillInRpt from './reports/drill-in'
import * as cp from 'child_process';

let sanitize = require('sanitize-filename');
let clone = require('clone');

import { GeneratorConfiguration, IssueCard, ReportSnapshot, ReportConfig, ProjectsData, ProjectData, ProjectReportBuilder, ReportDetails } from './interfaces'

export async function generate(token: string, configYaml: string): Promise<ReportSnapshot> {
    console.log("Generating reports");

    let configPath = path.join(process.env["GITHUB_WORKSPACE"], configYaml);
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
    
    const workspacePath = process.env["GITHUB_WORKSPACE"];
    if (!workspacePath) {
        throw new Error("GITHUB_WORKSPACE not defined");
    }    
    snapshot.rootPath = path.join(workspacePath, snapshot.config.output);

    // apply defaults
    snapshot.config.output = snapshot.config.output || "_reports";

    // load up the projects, their columns and all the issue cards + events.
    let projectsData: ProjectsData = await loadProjectsData(token, config, snapshot);
    console.log("loaded.");

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

    await writeSnapshot(snapshot);

    // hand that full data set to each report to render
    for (const proj in projectsData) {
        const projectData = projectsData[proj];

        for (const report of config.reports) {
            let output = "";

            output += getReportHeading(report);
            console.log();
            console.log(`Generating ${report.name} for ${proj} ...`);
            await createReportPath(report);

            for (const reportSection of report.sections) {
                output += os.EOL;

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
    }

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
    const genPath = path.join(snapshot.rootPath, ".gen");
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

async function loadProjectsData(token: string, config: GeneratorConfiguration, snapshot: ReportSnapshot): Promise<ProjectsData> {
    console.log("Querying project data ...")

    let cachePath = path.join(snapshot.rootPath, ".data");
    let github = new GitHubClient(token, cachePath);

    let projMap = <ProjectsData>{};
    for (const projHtmlUrl of config.projects) {
        let proj = await github.getProject(projHtmlUrl);
        if (!proj) {
            throw new Error(`Project not found: ${projHtmlUrl}`);
        }

        projMap[projHtmlUrl] = proj;
    }

    
    //console.log(JSON.stringify(projMap, null, 2));

    for (const projectUrl of config.projects) {
        let project: ProjectData = projMap[projectUrl];

        project.columns = {}
        let cols = await github.getColumnsForProject(project);
        cols.forEach((col) => {
            projMap[projectUrl].columns[col.name] = col.id;
        })

        project.stages = {}
        for (const key in config.columnMap) {
            project.stages[key] = [];

            let colNames = config.columnMap[key];
            for (const colName of colNames) {
                let colId = projMap[projectUrl].columns[colName];

                let cards = await github.getCardsForColumns(colId, colName);

                for (const card of cards) {
                    // cached since real column could be mapped to two different mapped columns
                    // read and build the event list once
                    let issueCard = await github.getIssueForCard(card, project.id);
                    if (issueCard) {
                        util.processCard(issueCard, project.id, config);
                        project.stages[key].push(issueCard);
                    }
                }
            }
        }
    }

    return projMap;
}
