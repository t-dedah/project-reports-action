import * as util from '../util'

import {IssueCard, GeneratorConfiguration} from '../interfaces';

let testData = require('./util.test.json');
let card = testData["card"] as IssueCard;

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

    util.processCard(card, 4969651, config);
    expect(card).toBeDefined();
    expect(card.events[0].data.stage_name).toBe("Proposed");
  });
});