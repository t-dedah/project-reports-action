import * as util from '../util'

import {IssueCard, GeneratorConfiguration} from '../interfaces';

let doneCard = require('./util.test.done.json') as IssueCard;

describe('util', () => {

  beforeEach(() => {
  });

  afterEach(() => {

  });

  afterAll(async () => {}, 100000);

  it('gets stage from column mapping', async () => {
    let config = <GeneratorConfiguration>{};
    config.columnMap = {
        "Proposed": [
          "In Box"
        ],
        "Accepted": [
          "Next"
        ],
        "In-Progress": [
          "In Progress"
        ],
        // intentionally commented core one out to show we're leaving this out and testing it resolves ("Done")
        // "Done": [
        //   "Complete"
        // ],
        "Blocked": []
      };

    expect(util.getStageFromColumn("In Box", config)).toBe("Proposed");

    // call again to ensuring caching doesn't break it
    expect(util.getStageFromColumn("In Box", config)).toBe("Proposed");

    // case insensitive matching
    expect(util.getStageFromColumn("in progress", config)).toBe("In-Progress");

    // an map with no values should still resolve to the default set regardless of case
    expect(util.getStageFromColumn("blocked", config)).toBe("Blocked");
    expect(util.getStageFromColumn("Blocked", config)).toBe("Blocked");

    // stage missing from mapping still resolves. regardless of case as well
    // e.g. user doesn't have to map if there columns are same as stage names
    expect(util.getStageFromColumn("done", config)).toBe("Done");
    expect(util.getStageFromColumn("Done", config)).toBe("Done");
  });

  it('adds stage to column events', async () => {
    let config = <GeneratorConfiguration>{};
    config.columnMap = {
        "Proposed": [
          "In Box"
        ],
        "Accepted": [
          "Next"
        ],
        "In-Progress": [
          "In Progress"
        ],
        "Done": [
          "Complete"
        ],
        "Blocked": []
      };    

    util.processCard(doneCard, 4969651, config);
    expect(doneCard).toBeDefined();
    expect(doneCard.events[0].data.stage_name).toBe("Proposed");
    expect(doneCard.stage).toBe("Done");
    
    expect(doneCard.added_at.toString()).toBe("2020-07-14T19:49:10.000Z");
    expect(doneCard.accepted_at.toString()).toBe("2020-07-14T19:54:58.000Z");
    expect(doneCard.in_progress_at.toString()).toBe("2020-07-14T19:59:45.000Z");
    expect(doneCard.done_at.toString()).toBe("2020-07-14T21:14:27.000Z");
    expect(doneCard.proposed_at).toBeDefined();

    // console.log(JSON.stringify(doneCard, null, 2));
  });
});