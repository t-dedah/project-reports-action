## Dev

```bash
$ npm install   #once
$ npm run build
```

**Interactively run:**  

This seems to work for now.  Runs the action interactively with this dir as the workspace root.

```bash
$ export GHPAT="yourpat-to-read-proj-data"
$ ./interactive.sh samples/sample.yaml
```

After you run it, you should see stuff under .reports.
All the query results will be cached and written to .reports/.data if you want to inspect.
