import clone from 'clone'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import moment from 'moment'
import * as mustache from 'mustache'
import * as os from 'os'
import * as path from 'path'
import sanitize from 'sanitize-filename'
import * as url from 'url'
import {Crawler} from './crawler'
import {GitHubClient} from './github'
import {
  CrawlingConfig,
  CrawlingTarget,
  GeneratorConfiguration,
  ProjectProcessor,
  ProjectReportBuilder,
  ReportConfig,
  ReportDetails,
  ReportSnapshot,
  RuntimeModule
} from './interfaces'
import {IssueList, ProjectIssue} from './project-reports-lib'
import * as drillInRpt from './reports/drill-in'
import * as util from './util'

function heading(contents: string) {
  console.log()
  console.log(contents)
  console.log('-------------------------------------------------------------------------------')
}

function loadRuntimeModule(kind: 'report' | 'processor', moduleName: string) {
  // if it's a relative path, find in the workflow repo relative path.
  // this allows for consume of action to create their own modules
  // else look for built-ins
  let modulePath

  if (moduleName.startsWith('./')) {
    modulePath = path.join(process.env['GITHUB_WORKSPACE'], `${moduleName}`)
  } else {
    modulePath = path.join(__dirname, `./${kind}s/${moduleName}`)
  }

  console.log(`Loading: ${modulePath}`)

  if (!fs.existsSync(modulePath)) {
    throw new Error(`Module not found: ${moduleName}`)
  }

  /* eslint-disable-next-line @typescript-eslint/no-var-requires */
  const runtimeModule = require(modulePath) as RuntimeModule
  return runtimeModule
}

export async function generate(token: string, configYaml: string): Promise<ReportSnapshot> {
  const workspacePath = process.env['GITHUB_WORKSPACE']
  if (!workspacePath) {
    throw new Error('GITHUB_WORKSPACE not defined')
  }

  const configPath = path.join(workspacePath, configYaml)

  const config = <GeneratorConfiguration>yaml.load(fs.readFileSync(configPath, 'utf-8'))

  const snapshot = <ReportSnapshot>{}
  snapshot.datetime = new Date()

  // ISO8601 without separators—supported by moment, etc.
  snapshot.datetimeString = moment(snapshot.datetime).utc().format('YYYYMMDDTHHmmss.SSS[Z]')

  snapshot.config = config

  snapshot.config.output = snapshot.config.output || '.reports'
  snapshot.rootPath = path.join(workspacePath, snapshot.config.output)

  const cachePath = path.join(snapshot.rootPath, '.data')
  util.mkdirP(cachePath)

  console.log(`Writing snapshot to ${snapshot.rootPath}`)
  await createDataDir(snapshot)

  // update report config details
  for (const report of config.reports || []) {
    report.timezoneOffset = report.timezoneOffset || -8

    report.details = <ReportDetails>{
      time: moment().utcOffset(report.timezoneOffset).format('dddd, MMMM Do YYYY, h:mm:ss a')
    }
    report.details.rootPath = path.join(snapshot.rootPath, sanitize(report.name))
    report.details.fullPath = path.join(report.details.rootPath, snapshot.datetimeString)
    report.details.dataPath = path.join(report.details.fullPath, 'data')

    if (report.title) {
      report.title = mustache.render(report.title, {
        config: config,
        report: report
      })
    } else {
      report.title = ''
    }
  }

  let crawlCfg: CrawlingConfig
  if (typeof config.targets === 'string') {
    throw new Error('crawl config external files not supported yet')
  } else {
    crawlCfg = <CrawlingConfig>config.targets
  }

  // apply defaults to targets
  console.log('Applying target defaults ...')
  for (const targetName in crawlCfg) {
    const target = crawlCfg[targetName]
    console.log(targetName)
    if (target.type === 'project') {
      if (!target.columnMap) {
        target.columnMap = {}
      }

      // we always process stages unless you tell us not to
      console.log(`stages: ${target.stages}`)
      if (target.stages === undefined) {
        target['stages'] = true
      }

      if (!target.stages) {
        continue
      }

      const defaultStages = ['Proposed', 'Accepted', 'In-Progress', 'Done', 'Unmapped']
      for (const phase of defaultStages) {
        if (!target.columnMap[phase]) {
          target.columnMap[phase] = []
        }
      }

      target.columnMap['Proposed'].push('Proposed', 'New', 'Ready for Review', 'Ready for Triage', 'Not Started')
      target.columnMap['Accepted'].push('Accepted', 'Approved', 'Ready for Work', 'Up Next')
      target.columnMap['In-Progress'].push('In-Progress', 'In progress', 'InProgress', 'Active', 'Started')
      target.columnMap['Done'].push('Done', 'Completed', 'Complete')

      // Add some common mappings
      target.columnMap['Proposed'].push('Triage', 'Not Started')

      for (const mapName in target.columnMap) {
        target.columnMap[mapName] = target.columnMap[mapName].map(item => item.trim())
      }
    }
  }

  console.log('crawlConfig')
  console.log(JSON.stringify(crawlCfg, null, 2))

  const crawler: Crawler = new Crawler(token, cachePath)

  heading('Processing')

  const github = new GitHubClient(token, cachePath)
  for (const processor of config.processing || []) {
    if (!processor.target) {
      throw new Error(`Target not specified for processor ${processor.name}`)
    }

    const target = crawlCfg[processor.target]
    if (!target) {
      throw new Error(`Target ${processor.target} not found in the config targets`)
    }

    const processingModule = loadRuntimeModule('processor', processor.name) as ProjectProcessor

    // overlay user settings over default settings
    const config = processingModule.getDefaultConfiguration()
    for (const setting in processor.config || {}) {
      config[setting] = processor.config[setting]
    }

    heading(`Crawling target: '${processor.target}' for processor: '${processor.name}'`)
    const issues: ProjectIssue[] = await crawler.crawl(target)
    const set = new IssueList(issue => issue.html_url)
    set.add(issues)

    heading(`Processing target: '${processor.target}' with processor: '${processor.name}'`)
    await processingModule.process(target, config, set, github)
  }

  console.log()
  console.log('Generating Reports')
  for (const report of config.reports || []) {
    let output = ''

    ensureCleanReportsFolder(report.details.rootPath)

    output += getReportHeading(report)
    console.log()
    console.log(`Generating ${report.name} ...`)
    await createReportPath(report)

    if (!report.sections || report.sections.length == 0) {
      console.log('WARNING: report has no sections.  continuing')
      continue
    }

    for (let sectionIdx = 0; sectionIdx < report.sections.length; sectionIdx++) {
      const reportSection = report.sections[sectionIdx]

      // We only support rollup of repo issues.
      // once we move ProjectData to a distinct set, we can support project data as well
      // let projectData: ProjectData = null;

      output += `&nbsp;  ${os.EOL}`

      const reportModule = `${reportSection.name}`

      const reportGenerator = loadRuntimeModule('report', reportModule) as ProjectReportBuilder

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
        console.log(`Crawling target: '${targetName}' for report: '${report.name}', section '${reportSection.name}'`)
        console.log('-------------------------------------------------------------------------------')
        const target = crawlCfg[targetName]
        console.log(`Stages: ${target.stages}`)
        targets.push(target)

        if (reportGenerator.reportType !== 'any' && reportGenerator.reportType !== target.type) {
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
      const drillInCb = (identifier: string, title: string, cards: ProjectIssue[]) => {
        drillIns.push({
          identifier: identifier,
          title: title,
          cards: cards
        })
      }

      const processed = reportGenerator.process(config, clone(set), drillInCb)

      const sectionPath = `${sectionIdx.toString().padStart(2, '0')}-${reportModule}`

      config['_asof'] = new Date().toISOString()
      await writeSectionData(report, sectionPath, config, {
        type: reportModule,
        config: config,
        output: processed
      })

      report.kind = report.kind || ''

      if (report.kind === 'markdown') {
        console.log('Rendering markdown ...')
        // let data = reportGenerator.reportType == 'repo' ? targets : projectData;
        const resPath = path.join(report.details.fullPath, 'res')
        util.mkdirP(resPath)
        output += reportGenerator.renderMarkdown(targets, processed)
      } else {
        console.log('Not processing reports.  Only output.')
      }

      for (const drillIn of drillIns) {
        let drillInReport: string
        if (report.kind === 'markdown') {
          drillInReport = drillInRpt.renderMarkdown(drillIn.title, clone(drillIn.cards))

          await writeDrillIn(report, sectionPath, drillIn.identifier, drillIn.cards, drillInReport)
        } else {
          console.log('Not processing reports.  Only output.')
        }
      }
    }

    if (report.kind !== '') {
      console.log('Writing report')
      writeReport(report, crawler.getTargetData(), output)
    }

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

async function ensureCleanReportsFolder(targetPath: string) {
  console.log()
  console.log(`Cleaning report path: ${targetPath}`)
  fs.rmdirSync(targetPath, {recursive: true})
  fs.mkdirSync(targetPath, {recursive: true})
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
    path.join(report.details.dataPath, reportModule, 'details', `${identifier}.json`),
    JSON.stringify(cards, null, 2)
  )
  fs.writeFileSync(path.join(report.details.rootPath, `${identifier}.md`), contents)
  fs.writeFileSync(path.join(report.details.fullPath, `${identifier}.md`), contents)
}

// creates directory structure for the reports and hands back the root path to write reports in
async function createDataDir(snapshot: ReportSnapshot) {
  console.log('Writing snapshot data ...')
  const genPath = path.join(snapshot.rootPath, '.data')
  util.mkdirP(genPath)
}

async function createReportPath(report: ReportConfig) {
  console.log(`Creating report path: ${report.details.fullPath}`)
  if (!fs.existsSync(report.details.fullPath)) {
    fs.mkdirSync(report.details.fullPath, {recursive: true})
  }

  util.mkdirP(report.details.dataPath)
}

async function writeSectionData(report: ReportConfig, name: string, settings: any, processed: any) {
  console.log(`Writing section data for ${name}...`)
  const sectionPath = path.join(report.details.fullPath, 'data', sanitize(name))
  util.mkdirP(sectionPath)

  fs.writeFileSync(path.join(sectionPath, 'config.json'), JSON.stringify(settings, null, 2))
  fs.writeFileSync(path.join(sectionPath, 'output.json'), JSON.stringify(processed, null, 2))
}

async function writeReport(report: ReportConfig, targetData: any, contents: string) {
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
