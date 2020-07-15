import * as path from 'path'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as github from './github'
import {GeneratorConfiguration, ReportSnapshot, ReportConfiguration, ProjectsData, ProjectData, ProjectReport} from './interfaces'

export async function generate(token: string, configYaml: string): Promise<ReportSnapshot> {
    console.log("Generating reports");

    let configPath = path.join(__dirname, configYaml);
    let config = <GeneratorConfiguration>yaml.load(fs.readFileSync(configPath, 'utf-8'))

    let snapshot = <ReportSnapshot>{};
    snapshot.datetime = new Date();
    snapshot.config = config;

    // apply defaults
    snapshot.config.output = snapshot.config.output || "_reports";

    // load up the projects, their columns and all the issue cards + events.
    let projectsData: ProjectsData = await loadProjectsData(token, config);

    let outPath = await writeSnapshot(snapshot);

    // hand that full data set to each report to render
    for (const proj in projectsData) {
        const projectData = projectsData[proj];

        for (const reportConfig of config.reports) {
            console.log(`Generating ${reportConfig.name} for ${proj} ...`);

            // TODO: offer a config setting for the report path.
            //       this will allow reports to be cloned and run 
            let reportModule = `./reports/${reportConfig.name}`;
            if (!fs.existsSync(path.join(__dirname, `${reportModule}.js`))) {
                throw new Error(`Report not found: ${reportConfig.name}`);
            }
    
            // run as many reports as we can but fail action if any failed.
            let failed = [];
            try {
                let report = require(reportModule) as ProjectReport;
    
                let processed = report.process(projectData);
                let contents = report.render(processed);
                writeReport(outPath, reportConfig, projectData, contents);
            }
            catch (err) {
                console.error(`Failed: ${err.message}`);
                failed.push({ report: reportConfig.name, error: err })
            }
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

async function writeReport(basePath: string, reportConfig: ReportConfiguration, projectData: ProjectData, contents: string) {
    const reportPath = path.join(basePath, reportConfig.name);
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
