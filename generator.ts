import clone from 'clone'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import moment from 'moment'
import * as mustache from 'mustache'
// import {GitHubClient} from './github'
import * as os from 'os'
import * as path from 'path'
import sanitize from 'sanitize-filename'
import * as url from 'url'
import {Crawler} from './crawler'
import {
  CrawlingConfig,
  CrawlingTarget,
  GeneratorConfiguration,
  ProjectReportBuilder,
  ReportConfig,
  ReportDetails,
  ReportSnapshot
} from './interfaces'
import {IssueList, ProjectIssue} from './project-reports-lib'
import * as drillInRpt from './reports/drill-in'
import * as util from './util'

export async function generate(
  token: string,
  configYaml: string
): Promise<ReportSnapshot> {
  const workspacePath = process.env['GITHUB_WORKSPACE']
  if (!workspacePath) {
    throw new Error('GITHUB_WORKSPACE not defined')
  }

  const configPath = path.join(workspacePath, configYaml)
  const cachePath = path.join(workspacePath, '_reports', '.data')
  util.mkdirP(cachePath)

  const config = <GeneratorConfiguration>(
    yaml.load(fs.readFileSync(configPath, 'utf-8'))
  )

  const snapshot = <ReportSnapshot>{}
  snapshot.datetime = new Date()

  // ISO8601 without separators—supported by moment, etc.
  snapshot.datetimeString = moment(snapshot.datetime)
    .utc()
    .format('YYYYMMDDTHHmmss.SSS[Z]')

  snapshot.config = config

  snapshot.config.output = snapshot.config.output || '_reports'
  snapshot.rootPath = path.join(workspacePath, snapshot.config.output)

  console.log(`Writing snapshot to ${snapshot.rootPath}`)
  await writeSnapshot(snapshot)

  // update report config details
  for (const report of config.reports) {
    report.timezoneOffset = report.timezoneOffset || -8

    report.details = <ReportDetails>{
      time: moment()
        .utcOffset(report.timezoneOffset)
        .format('dddd, MMMM Do YYYY, h:mm:ss a')
    }
    report.details.rootPath = path.join(
      snapshot.rootPath,
      sanitize(report.name)
    )
    report.details.fullPath = path.join(
      report.details.rootPath,
      snapshot.datetimeString
    )
    report.details.dataPath = path.join(report.details.fullPath, 'data')

    report.title = mustache.render(report.title, {
      config: config,
      report: report
    })
  }

  let crawlCfg: CrawlingConfig
  if (typeof config.targets === 'string') {
    throw new Error('crawl config external files not supported yet')
  } else {
    crawlCfg = <CrawlingConfig>config.targets
  }

  // apply defaults to targets
  console.log('Applying target defaults')
  for (const targetName in crawlCfg) {
    const target = crawlCfg[targetName]
    if (target.type === 'project') {
      if (!target.columnMap) {
        target.columnMap = {}
      }

      const defaultStages = [
        'Proposed',
        'Accepted',
        'In-Progress',
        'Done',
        'Unmapped'
      ]
      for (const phase of defaultStages) {
        if (!target.columnMap[phase]) {
          target.columnMap[phase] = []
        }
      }

      target.columnMap['Proposed'].push('Proposed', 'Not Started')
      target.columnMap['In-Progress'].push(
        'In-Progress',
        'In progress',
        'InProgress',
        'Started'
      )
      target.columnMap['Accepted'].push('Accepted', 'Approved', 'Up Next')
      target.columnMap['Done'].push('Done', 'Completed', 'Complete')

      // Add some common mappings
      target.columnMap['Proposed'].push('Triage', 'Not Started')

      for (const mapName in target.columnMap) {
        target.columnMap[mapName] = target.columnMap[mapName].map(item =>
          item.trim()
        )
      }
    }
  }

  console.log('crawlConfig')
  console.log(JSON.stringify(crawlCfg, null, 2))

  const crawler: Crawler = new Crawler(token, cachePath)

  for (const report of config.reports) {
    let output = ''

    // gather all the markdown files in the root to delete before writing new files
    deleteFilesInPath(report.details.rootPath)

    output += getReportHeading(report)
    console.log()
    console.log(`Generating ${report.name} ...`)
    await createReportPath(report)

    for (
      let sectionIdx = 0;
      sectionIdx < report.sections.length;
      sectionIdx++
    ) {
      const reportSection = report.sections[sectionIdx]

      // We only support rollup of repo issues.
      // once we move ProjectData to a distinct set, we can support project data as well
      // let projectData: ProjectData = null;

      output += `&nbsp;  ${os.EOL}`

      const reportModule = `${reportSection.name}`

      // if it's a relative path, find in the workflow repo relative path.
      // this allows for consume of action to create their own report sections
      // else look for built-ins
      console.log(`Report module ${reportModule}`)
      let reportModulePath

      if (reportModule.startsWith('./')) {
        reportModulePath = path.join(
          process.env['GITHUB_WORKSPACE'],
          `${reportModule}`
        )
      } else {
        reportModulePath = path.join(
          __dirname,
          `./reports/${reportSection.name}`
        )
      }

      console.log(`Loading: ${reportModulePath}`)

      if (!fs.existsSync(reportModulePath)) {
        throw new Error(`Report not found: ${reportSection.name}`)
      }

      /* eslint-disable-next-line @typescript-eslint/no-var-requires */
      const reportGenerator = require(reportModulePath) as ProjectReportBuilder

      // overlay user settings over default settings
      const config = reportGenerator.getDefaultConfiguration()
      for (const setting in reportSection.config || {}) {
        config[setting] = reportSection.config[setting]
      }

      // ----------------------------------------------------------------------
      // Crawl targets data.
      // definition on section but fall back to report
      // ----------------------------------------------------------------------
      const targetNames = reportSection.targets || report.targets

      const set = new IssueList(issue => issue.html_url)

      const targets: CrawlingTarget[] = []
      for (const targetName of targetNames) {
        console.log()
        console.log(
          `Crawling target: '${targetName}' for report: '${report.name}', section '${reportSection.name}'`
        )
        console.log(
          '-------------------------------------------------------------------------------'
        )
        const target = crawlCfg[targetName]
        targets.push(target)

        if (
          reportGenerator.reportType !== 'any' &&
          reportGenerator.reportType !== target.type
        ) {
          throw new Error(
            `Report target mismatch.  Target is of type ${target.type} but report section is ${reportGenerator.reportType}`
          )
        }

        const data: ProjectIssue[] = await crawler.crawl(target)
        console.log(`Adding ${data.length} issues to set ...`)
        set.add(data)
      }

      console.log(`Issues set has ${set.getItems().length}`)

      console.log('Processing data ...')

      const drillIns = []
      const drillInCb = (
        identifier: string,
        title: string,
        cards: ProjectIssue[]
      ) => {
        drillIns.push({
          identifier: identifier,
          title: title,
          cards: cards
        })
      }

      const processed = reportGenerator.process(config, clone(set), drillInCb)

      const sectionPath = `${sectionIdx
        .toString()
        .padStart(2, '0')}-${reportModule}`

      await writeSectionData(report, sectionPath, config, {
        type: reportModule,
        output: processed
      })

      report.kind = report.kind || 'markdown'

      if (report.kind === 'markdown') {
        console.log('Rendering markdown ...')
        // let data = reportGenerator.reportType == 'repo' ? targets : projectData;
        output += reportGenerator.renderMarkdown(targets, processed)
      } else {
        throw new Error(`Report kind ${report.kind} not supported`)
      }

      for (const drillIn of drillIns) {
        let drillInReport: string
        if (report.kind === 'markdown') {
          drillInReport = drillInRpt.renderMarkdown(
            drillIn.title,
            clone(drillIn.cards)
          )
        } else {
          throw new Error(`Report kind ${report.kind} not supported`)
        }

        await writeDrillIn(
          report,
          sectionPath,
          drillIn.identifier,
          drillIn.cards,
          drillInReport
        )
      }
    }

    console.log('Writing report')
    writeReport(report, crawler.getTargetData(), output)
    console.log('Done.')
  }
  console.log()

  return snapshot
}

function getReportHeading(report: ReportConfig) {
  const lines: string[] = []

  if (report.kind === 'markdown') {
    lines.push(`# :crystal_ball: ${report.title}  `)
    lines.push('  ')
    lines.push(
      `Generated with :heart: by [project-reports-action](https://github.com/bryanmacfarlane/project-reports-action)  `
    )
    lines.push(`<sub><sup>${report.details.time}</sup></sub>  `)
    lines.push('  ')
  }

  return lines.join(os.EOL)
}

async function deleteFilesInPath(targetPath: string) {
  console.log()
  if (!fs.existsSync(targetPath)) {
    return
  }

  let existingRootFiles = fs
    .readdirSync(targetPath)
    .map(item => path.join(targetPath, item))
  existingRootFiles = existingRootFiles.filter(item =>
    fs.lstatSync(item).isFile()
  )
  for (const file of existingRootFiles) {
    console.log(`cleaning up ${file}`)
    fs.unlinkSync(file)
  }
}

async function writeDrillIn(
  report: ReportConfig,
  reportModule: string,
  identifier: string,
  cards: ProjectIssue[],
  contents: string
) {
  console.log(`Writing drill-in data for ${identifier} ...`)

  util.mkdirP(path.join(report.details.dataPath, reportModule, 'details'))

  fs.writeFileSync(
    path.join(
      report.details.dataPath,
      reportModule,
      'details',
      `${identifier}.json`
    ),
    JSON.stringify(cards, null, 2)
  )
  fs.writeFileSync(
    path.join(report.details.rootPath, `${identifier}.md`),
    contents
  )
  fs.writeFileSync(
    path.join(report.details.fullPath, `${identifier}.md`),
    contents
  )
}

// creates directory structure for the reports and hands back the root path to write reports in
async function writeSnapshot(snapshot: ReportSnapshot) {
  console.log('Writing snapshot data ...')
  const genPath = path.join(snapshot.rootPath, '.data')
  util.mkdirP(genPath)

  const snapshotPath = path.join(genPath, `${snapshot.datetimeString}.json`)
  console.log(`Writing to ${snapshotPath}`)

  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))
}

async function createReportPath(report: ReportConfig) {
  console.log(`Creating report path: ${report.details.fullPath}`)
  if (!fs.existsSync(report.details.fullPath)) {
    fs.mkdirSync(report.details.fullPath, {recursive: true})
  }

  util.mkdirP(report.details.dataPath)
}

async function writeSectionData(
  report: ReportConfig,
  name: string,
  settings: any,
  processed: any
) {
  console.log(`Writing section data for ${name}...`)
  const sectionPath = path.join(report.details.fullPath, 'data', sanitize(name))
  util.mkdirP(sectionPath)

  fs.writeFileSync(
    path.join(sectionPath, 'config.json'),
    JSON.stringify(settings, null, 2)
  )
  fs.writeFileSync(
    path.join(sectionPath, 'output.json'),
    JSON.stringify(processed, null, 2)
  )
}

async function writeReport(
  report: ReportConfig,
  targetData: any,
  contents: string
) {
  console.log('Writing the report ...')
  fs.writeFileSync(path.join(report.details.rootPath, '_report.md'), contents)
  fs.writeFileSync(path.join(report.details.fullPath, '_report.md'), contents)
  for (const target in targetData) {
    const urlPath = url.parse(target).path.split('/').join('_')
    fs.writeFileSync(
      path.join(report.details.dataPath, `target-${sanitize(urlPath)}.json`),
      JSON.stringify(targetData[target], null, 2)
    )
  }
}
