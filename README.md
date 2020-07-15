# Project Report Generator

Early personal experiment.  Do not rely on this.  Changing.

# Dev

```bash
$ npm install   #once
$ npm run build
```

Interactively run:

This seems to work for now.  Runs the action interactively with this dir as the workspace root.

```bash
$ export GHPAT="yourpat-to-read-proj-data"
$ ./interactive.sh samples/sample.yaml
```

After you run it, you should see stuff under _reports.
All the query results will be cached and written to _cache if you want to inspect.

# Use in workflow

Haven't run this way yet.  Need to make public next and then create another private repo to run my reports and check them in.

1. Create a yaml config file.  See `samples/sample.yaml` 
2. Create a actions secret named PROJECT_TOKEN in your repo in the admin UI
3. Add this step to your workflow

```yaml
- uses: bryanmacfarlane/project-reports@master
  with:
    token: ${{ github.secrets.PROJECT_TOKEN }}
    configPath: samples/sample.yaml
```

Note that the configPath is relative to the root of the repo
See `actions.yml` for more details

# TODO

generator:
1. overlay report config over default config
2. issue events are being retrieved by not added to the project data structure.  bug
3. Some events seem to be missing.  Investigate
4. Allow reports to come from an npm module (currently acquiring by path but also support by module name).  This allow this tool to be separate from the reports being used.  An org could create one module with all their reports or many.

reports
1. wip-limits
2. ... others after 4 above??

tests
1.  Add some tests.  If we copy over an instance cache into a mock directory then we could run end to end and shortcut the n^3 queries and test the report generation?
