# Configuration Details

A sample configuration file show more detailed settings is in [samples/sample.yaml](../samples/sample.yaml).

A configuration file has:

- **targets**: a target is a project board or a repository that you want to report on.  A target may have settings.  For example, a project board might have the column names   

### Targets

Targets are named references to a project board or repo.  Both have an html url which is the url you see in the browser.  A project target can also have a `columnMap` to map the logical stage to the physical column.

```yaml
name: myconfig

targets:
  quotesFeedRepo:
    type: repo
    htmlUrl: https://github.com/bryanmacfarlane/quotes-feed
  sanenodeRepo:
    type: repo
    htmlUrl: https://github.com/bryanmacfarlane/sanenode    
  todoProject:
    type: project
    htmlUrl: https://github.com/users/bryanmacfarlane/projects/1
    columnMap:
      Proposed: ["In Box"]           # Drafts author is working on.  Has a chance of moving soon
      Accepted: [
        "Up Next",                   # Ready for review
        "Next"]                      # Previous name of column       
      In-Progress: ["In Progress"]   # Work is underway
      Done: ["Complete"]             # Celebrate
```

Give the config file a name (just used for logging etc).  Note: Might remove and just use path.

Column mappings allow board columns to be mapped to logical stages.  The tool will also fuzzy match which means if you're inexact with casing, spaces, missing emojis etc., it will still match.  It breaks into alphanumeric words and matches all words in the mapping to words in the column name.  So, for example, an 'in progress' mapping will match an 'In-progress ' column.

### Output

Output is the path where the reports and the data generated will be written.

```yaml
output: "_reports"
```

> `Issue`: For now, use path starting with `_reports` as the value.  It will be the relative folder soon.  

### Report definition

A report will generate one markdown file (and related files).  The `name` will be the file on disk created and the `title` will be the heading 1 title header.

`kind` is only supported as markdown.  We may add html and / or json.

`timezoneOffset` is the timezone dates and times will be reported as. 

`targets` is a report section concept but if you supply it at the reports level, it will apply to all sections.  This is the typical case.

```yaml
reports:
  - name: TODO
    title: "My Project Report"
    kind: markdown 
    timezoneOffset: -8
    targets: ['todoProject']
```

### Report Sections

A report is comprised of many sections which actually present the data as tables and lists.

```yaml
reports:
  - name: TODO
...
    sections:
      - name: "project-limits"
        config: 
          report-on-label: '*'
          accepted-limit: 2
          in-progress-limit: 2
          count-label-match: "(\\d+)-dev"
```

Each section references the `name` of a report.

> Important: reports that start with `project-` are project reports and expect a project target.  Reports that start with `repo-` are repository reports and expect a repo target.  The generator will error out with a good message if you mix.  Note that data from a project board has stage data on it like `project_added_at`, `progress-in-progress-at` etc.  Those reports expect that.

The `config` settings are specific to each report.   However, note that each report supplies defaults and you only need to specify what's different from that.