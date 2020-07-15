# Project Report Generator

Early personal experiment.  Do not rely on this.  Changing.

# Dev

```bash
$ npm install   #once
$ npm run build
```

Interactively run:
```bash
$ export GHPAT="yourpat-to-read-proj-data"
$ ./interactive.sh samples/sample.yaml
```

# Use in workflow

1. Create a yaml config file.  See `samples/sample.yaml` 
2. Create a actions secret named PROJECT_TOKEN in your repo in the admin UI
3. Add this step to your workflow

```yaml
- uses: bryanmacfarlane/project-reports@master
  token: ${{ github.secrets.PROJECT_TOKEN }}
  configPath: samples/sample.yaml
```

Note that the configPath is relative to the root of the repo
See `actions.yml` for more details
