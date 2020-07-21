import {GeneratorConfiguration, IssueCard, ProjectData} from './interfaces'

export function getTimeForOffset(date: Date, offset: number) {
    var utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    var nd = new Date(utc + (3600000*offset));
    return nd.toLocaleString();
}

// cache the resolution of stage names for a column
// a columns by stage names are the default and resolve immediately
let _columnMap = {
    "proposed": "Proposed",
    "accepted": "Accepted",
    "in-progress": "In-Progress",
    "done": "Done",
    "blocked": "Blocked"
}

export function getStageFromColumn(column: string, config: GeneratorConfiguration): string {
    column = column.toLowerCase();
    if (_columnMap[column]) {
        return _columnMap[column];
    }

    let resolvedStage = null;
    for (let stageName in config.columnMap) {
        // case insensitve match
        for (let mappedColumn of config.columnMap[stageName]) {
            let lowerColumn = mappedColumn.toLowerCase();
            if (lowerColumn === column.toLowerCase()) {
                resolvedStage = stageName;
                break;
            }
        }

        if (resolvedStage) {
            break;
        }
    }

    // cache the n^2 reverse case insensitive lookup.  it will never change for this run
    if (resolvedStage) {
        _columnMap[column] = resolvedStage;
    }

    return resolvedStage;
}

// process a card in context of the project it's being added to
// filter column events to the project being processed only since. this makes it easier on the report author
// add stage name to column move events so report authors don't have to repeatedly to that
export function processCard(card: IssueCard, projectId: number, config: GeneratorConfiguration) {
    let filteredEvents = [];
    if (card.events) {
        for (let event of card.events) {
            // since we're adding this card to a projects / stage, let's filter out
            // events for other project ids since an issue can be part of multiple boards
            if (event.data["project_id"] && event.data["project_id"] !== projectId) {
                continue;
            }
            
            if (event.data["column_name"]) {
                event.data["stage_name"] = getStageFromColumn(event.data["column_name"], config);
            }
    
            if (event.data["previous_colum_name"]) {
                event.data["stage_name"] = getStageFromColumn(event.data["previous_colum_name"], config);
            }
            
            filteredEvents.push(event);
        }
        card.events = filteredEvents;
    }
}

