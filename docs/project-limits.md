# project-limits

![project-limits](./project-limits.png)

## Sample config

```yaml
reports:
..
    sections:
      - name: "project-limits"
        config: 
          report-on-label: 'Epic'
          accepted-limit: 2
          in-progress-limit: 2
```

## report-on-label

Breakdown counts by this label.  

**Default**: `Epic` (also matches `epic` labels)
**any**: `*` is supported which represents all cards.

## (stage)-limit

Specify a limit for the number of items allowed at a stage.  Defaults:

**proposed-limit**: 0    
**accepted-limit**: 0  
**in-progress-limit**: 4  
**done-limit**: 0  


