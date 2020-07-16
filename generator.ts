import * as path from 'path'
import * as fs from 'fs'
import * as util from './util'
import * as yaml from 'js-yaml'
import * as github from './github'
import * as os from 'os';
import * as mustache from 'mustache'
let sanitize = require('sanitize-filename')

import {GeneratorConfiguration, ReportSnapshot, ReportConfig, ProjectsData, ProjectData, ProjectReportBuilder, ReportDetails} from './interfaces'

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

        report.name = mustache.render(report.name, {
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
            console.log(`Generating ${report.name} for ${proj} ...`);

            for (const reportSection of report.sections) {
                output += os.EOL;
                // TODO: offer a config setting for the report path.
                //       this will allow reports to be cloned and run 
                let reportModule = `./reports/${reportSection.name}`;
                if (!fs.existsSync(path.join(__dirname, `${reportModule}.js`))) {
                    throw new Error(`Report not found: ${report.name}`);
                }
        
                // run as many reports as we can but fail action if any failed.
                let failed = [];
                try {
                    let reportGenerator = require(reportModule) as ProjectReportBuilder;
        
                    let processed = reportGenerator.process(projectData);
                    output += reportGenerator.render(processed);
                }
                catch (err) {
                    console.error(`Failed: ${err.message}`);
                    failed.push({ report: report.name, error: err })
                }
            }
            writeReport(outPath, report, projectData, output);            
        }
    }

    // TODO: throw if failed length > 0

    return snapshot;
}

// creates directory structure for the reports and hands back the root path to write reports in
async function writeSnapshot(snapshot: ReportSnapshot): Promise<string> {
    const workspacePath = process.env["GITHUB_WORKSPACE"];
    if (!workspacePath) {
        throw new Error("GITHUB_WORKSPACE not defined");
    }

    let d = snapshot.datetime;
    let dt:string = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDay()}_${d.getUTCHours()}-${d.getUTCMinutes()}`;
    const snapshotPath = path.join(workspacePath, snapshot.config.output, dt);
    if (!fs.existsSync(snapshotPath)) {
        fs.mkdirSync(snapshotPath, { recursive: true });
    }
    
    fs.writeFileSync(path.join(snapshotPath, "snapshot.json"), JSON.stringify(snapshot, null, 2));
    return snapshotPath;
}

async function writeReport(basePath: string, report: ReportConfig, projectData: ProjectData, contents: string) {
    const reportPath = path.join(basePath, sanitize(report.name));
    if (!fs.existsSync(reportPath)) {
        fs.mkdirSync(reportPath);
    }

    fs.writeFileSync(path.join(reportPath, "report.md"), contents);
    fs.writeFileSync(path.join(reportPath, "data.json"), JSON.stringify(projectData, null, 2));
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
                        project.stages[key].push(issueCard);
                    }
                }
            }
        }
    }

    return projMap;
}
