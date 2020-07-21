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

let stageLevel = {
    "None": 0,
    "Proposed": 1,
    "Accepted": 2,
    "In-Progress": 3,
    "Blocked": 4,
    "Done": 5
}

// keep in order indexed by level above
let stageAtNames = [
    'none',
    'proposed_at',
    'accepted_at',
    'in_progress_at',
    'blocked_at',
    'done_at'
]

// process a card in context of the project it's being added to
// filter column events to the project being processed only since. this makes it easier on the report author
// add stage name to column move events so report authors don't have to repeatedly to that
export function processCard(card: IssueCard, projectId: number, config: GeneratorConfiguration) {
    let filteredEvents = [];

    // card events should be in order chronologically
    let currentStage: string;
    let doneTime: Date;
    let blockedTime: Date;
    let addedTime: Date;

    if (card.events) {
        for (let event of card.events) {
            // since we're adding this card to a projects / stage, let's filter out
            // events for other project ids since an issue can be part of multiple boards
            if (event.data["project_id"] && event.data["project_id"] !== projectId) {
                continue;
            }
            
            let eventDateTime: Date;
            if (event.created) {
                eventDateTime = event.created;
            }

            // TODO: should I clear all the stage_at datetimes if I see
            //       removed_from_project event?

            let toStage: string;
            let toLevel: number;
            let fromStage: string;
            let fromLevel: number = 0;

            if (event.data["column_name"]) {
                if (!addedTime) {
                    addedTime = eventDateTime;
                }

                toStage = event.data["stage_name"] = getStageFromColumn(event.data["column_name"], config);
                toLevel = stageLevel[toStage];
                currentStage = toStage;
            }
    
            if (event.data["previous_column_name"]) {
                fromStage = event.data["previous_stage_name"] = getStageFromColumn(event.data["previous_column_name"], config);
                fromLevel = stageLevel[fromStage];
            }

            // last occurence of moving to these columns from a lesser or no column
            // example. if moved to accepted from proposed (or less), 
            //      then in-progress (greater) and then back to accepted, first wins            
            if (toStage === 'Proposed' || toStage === 'Accepted' || toStage === 'In-Progress') {
                if (toLevel > fromLevel) {
                    card[stageAtNames[toLevel]] = eventDateTime;
                } 
            }

            if (toStage === 'Done') {
                doneTime = eventDateTime;
            }

            if (toStage === 'Blocked') {
                blockedTime = eventDateTime;
            }

            filteredEvents.push(event);
        }
        card.events = filteredEvents;

        // done_at and blocked_at is only set if it's currently at that stage
        if (currentStage === 'Done') {
            card.done_at = doneTime;
        }

        if (currentStage === 'Bloced') {
            card.blocked_at = blockedTime
        }

        if (addedTime) {
            card.added_at = addedTime;
        }

        card.stage = currentStage;
    }
}

