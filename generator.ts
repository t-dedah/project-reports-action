import * as path from 'path'
import * as fs from 'fs'
import * as util from './util'
import * as yaml from 'js-yaml'
import * as github from './github'
import * as os from 'os';
import * as mustache from 'mustache'
import * as drillInRpt from './reports/drill-in'
import * as cp from 'child_process';
import * as shell from 'shelljs';

let sanitize = require('sanitize-filename')

import { GeneratorConfiguration, IssueCard, ReportSnapshot, ReportConfig, ProjectsData, ProjectData, ProjectReportBuilder, ReportDetails } from './interfaces'

export async function generate(token: string, configYaml: string): Promise<ReportSnapshot> {
    console.log("Generating reports");

    let configPath = path.join(process.env["GITHUB_WORKSPACE"], configYaml);
    let config = <GeneratorConfiguration>yaml.load(fs.readFileSync(configPath, 'utf-8'))

    let snapshot = <ReportSnapshot>{};
    snapshot.datetime = new Date();
    snapshot.config = config;

    // apply defaults
    snapshot.config.output = snapshot.config.output || "_reports";

    // load up the projects, their columns and all the issue cards + events.
    let projectsData: ProjectsData = await loadProjectsData(token, config);

    // update report config details
    for (const report of config.reports) {
        report.timezoneOffset = report.timezoneOffset || -8;

        report.details = <ReportDetails>{
            time: util.getTimeForOffset(snapshot.datetime, report.timezoneOffset)
        }

        report.title = mustache.render(report.title, {
            config: config,
            report: report
        });
    }

    let outPath = await writeSnapshot(snapshot);

    // hand that full data set to each report to render
    for (const proj in projectsData) {
        const projectData = projectsData[proj];

        for (const report of config.reports) {
            let output = "";

            output += getReportHeading(report);
            console.log();
            console.log(`Generating ${report.name} for ${proj} ...`);
            let reportPath = await createReportPath(outPath, report, snapshot);

            for (const reportSection of report.sections) {
                output += os.EOL;

                let reportModule = `${reportSection.name}`;
                try {
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
                    for (let setting in reportSection.config) {
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

                    let processed = reportGenerator.process(config, projectData, drillInCb);
                    await writeSectionData(reportPath, reportModule, config, processed);

                    if (report.kind === 'markdown') {
                        output += reportGenerator.renderMarkdown(projectData, processed);
                    }
                    else {
                        throw new Error(`Report kind ${report.kind} not supported`);
                    }

                    for (let drillIn of drillIns) {
                        let drillInReport: string;
                        if (report.kind === 'markdown') {
                            drillInReport = drillInRpt.renderMarkdown(drillIn.title, drillIn.cards);
                        }
                        else {
                            throw new Error(`Report kind ${report.kind} not supported`);
                        }

                        await writeDrillIn(reportPath, drillIn.identifier, drillIn.cards, drillInReport);
                    }
                }
                catch (err) {
                    console.error(err);
                    throw new Error(`Failed generating report ${report.name}, section ${reportModule}`);
                }
            }
            console.log("Writing report");
            writeReport(reportPath, report, projectData, output);
            console.log("Done.");
        }
        console.log();
    }

    return snapshot;
}

function getReportHeading(report: ReportConfig) {
    let lines: string[] = [];

    if (report.kind === "markdown") {
        lines.push(`# ${report.title}  `)
        lines.push('  ');
        lines.push(`Generated with :heart: by [project-reports-action](https://github.com/bryanmacfarlane/project-reports-action)  `);
        lines.push(`<sub><sup>${report.details.time}</sup></sub>  `);
        lines.push("  ");
    }
    
    return lines.join(os.EOL);
}
async function writeDrillIn(basePath: string, identifier: string, cards: IssueCard[], report: string) {
    let drillPath = path.join(basePath, 'data', identifier); // don't sanitize - must be valid dirname since parent report expects
    if (!fs.existsSync(drillPath)) {
        fs.mkdirSync(drillPath, { recursive: true });
    }

    fs.writeFileSync(path.join(drillPath, "cards.json"), JSON.stringify(cards, null, 2));
    fs.writeFileSync(path.join(drillPath, "cards.md"), report);
}

// creates directory structure for the reports and hands back the root path to write reports in
async function writeSnapshot(snapshot: ReportSnapshot): Promise<string> {
    const workspacePath = process.env["GITHUB_WORKSPACE"];
    if (!workspacePath) {
        throw new Error("GITHUB_WORKSPACE not defined");
    }

    let d = snapshot.datetime;
    let year = d.getUTCFullYear();
    let month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
    let day = d.getUTCDate().toString().padStart(2, "0");
    let hour = d.getUTCHours().toString().padStart(2, "0");
    let minute = d.getUTCMinutes().toString().padStart(2, "0");
    let dt: string = `${year}-${month}-${day}_${hour}-${minute}`;

    snapshot.datetimeString = dt;

    const rootPath = path.join(workspacePath, snapshot.config.output);
    const genPath = path.join(rootPath, ".gen");
    if (!fs.existsSync(genPath)) {
        fs.mkdirSync(genPath, { recursive: true });
    }

    const snapshotPath = path.join(genPath, `${snapshot.datetimeString}.json`);
    console.log(`Writing to ${snapshotPath}`);

    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
    return rootPath;
}

async function createReportPath(basePath: string, report: ReportConfig, snapshot: ReportSnapshot): Promise<string> {
    const reportPath = path.join(basePath, sanitize(report.name), snapshot.datetimeString);
    console.log(`Creating report path: ${reportPath}`);
    if (!fs.existsSync(reportPath)) {
        fs.mkdirSync(reportPath, { recursive: true });
    }

    return reportPath;
}

async function writeSectionData(reportPath: string, name: string, settings: any, processed: any) {
    const sectionPath = path.join(reportPath, "data", sanitize(name));
    if (!fs.existsSync(sectionPath)) {
        fs.mkdirSync(sectionPath, { recursive: true });
    }

    fs.writeFileSync(path.join(sectionPath, "settings.json"), JSON.stringify(settings, null, 2));
    fs.writeFileSync(path.join(sectionPath, "processed.json"), JSON.stringify(processed, null, 2));
}

async function writeReport(reportPath: string, report: ReportConfig, projectData: ProjectData, contents: string) {
    fs.writeFileSync(path.join(reportPath, "report.md"), contents);
    fs.writeFileSync(path.join(reportPath, "data.json"), JSON.stringify(projectData, null, 2));
    let reportsRoot = path.join(reportPath, "..");
    shell.pushd(reportsRoot);
    let reportFolder = path.basename(reportPath);
    console.log('current dir: ${process.cwd()}');
    console.log(`creating symbolic link: ${reportFolder} "latest"`);
    cp.exec(`unlink latest`);
    cp.execSync(`ln -sf "${reportFolder}" latest`);
    shell.popd();
}

async function loadProjectsData(token: string, config: GeneratorConfiguration): Promise<ProjectsData> {
    console.log("Querying project data ...")
    let projMap = <ProjectsData>{};
    for (const projHtmlUrl of config.projects) {
        let proj = await github.getProject(token, projHtmlUrl);
        if (!proj) {
            throw new Error(`Project not found: ${projHtmlUrl}`);
        }

        projMap[projHtmlUrl] = proj;
    }

    //console.log(JSON.stringify(projMap, null, 2));

    for (const projectUrl of config.projects) {
        let project: ProjectData = projMap[projectUrl];

        project.columns = {}
        let cols = await github.getColumnsForProject(token, project);
        cols.forEach((col) => {
            projMap[projectUrl].columns[col.name] = col.id;
        })

        project.stages = {}
        for (const key in config.columnMap) {
            project.stages[key] = [];

            let colNames = config.columnMap[key];
            for (const colName of colNames) {
                let colId = projMap[projectUrl].columns[colName];

                let cards = await github.getCardsForColumns(token, colId, colName);

                for (const card of cards) {
                    // cached since real column could be mapped to two different mapped columns
                    // read and build the event list once
                    let issueCard = await github.getIssueCard(token, card, project.id);
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
