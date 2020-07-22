import {ProjectData, IssueCard} from '../interfaces';
import * as wipLimits from '../reports/wip-limits';
import {WipData} from '../reports/wip-limits';

let projectData: ProjectData = require('./wip-limits.test.json');

let config: any = {
    'report-on': [ 'Epic', 'Feature' ],
    'epic-proposed': 2,
    'epic-accepted': 2,
    'epic-in-progress': 2,
    'epic-done': 100,
    'feature-accepted': 2,
    'feature-in-progress': 2,
    'label-match': '(\\d+)-dev'
  };

describe('report-lib', () => {

    beforeEach(() => {
    });
  
    afterEach(() => {
  
    });
  
    afterAll(async () => {}, 100000);
  
    // make sure the mocked data set is loaded and valid
    it('imports a valid projectData from file', async () => {
        expect(projectData).toBeDefined();
        expect(projectData.name).toBe("TODO");
        expect(projectData.stages["In-Progress"]).toBeDefined();
    });

    it('process returns WipData', async () => {
        let drillIns = [];
        let drillIn = (identifier: string, title: string, cards: IssueCard[]) => {
            drillIns.push(identifier);
        }

        let processed = wipLimits.process(config, projectData, drillIn) as WipData;
        //console.log(JSON.stringify(processed, null, 2));

        expect(processed).toBeDefined();
        expect(processed["Epic"]).toBeDefined();
        expect(processed["Epic"]["Proposed"]).toBeDefined();
        expect(processed["Epic"]["Proposed"].wips).toBe(0);
        expect(processed["Epic"]["Proposed"].limit).toBe(2);
        expect(processed["Epic"]["Proposed"].flag).toBe(false);
        expect(processed["Epic"]["In-Progress"]).toBeDefined();
        expect(processed["Epic"]["In-Progress"].wips).toBe(3);
        expect(processed["Epic"]["In-Progress"].limit).toBe(2);
        expect(processed["Epic"]["In-Progress"].flag).toBe(true);
        expect(processed["Epic"]["Accepted"]).toBeDefined();
        expect(processed["Epic"]["Done"]).toBeDefined();

        expect(processed["Feature"]["Proposed"]).toBeDefined();
        expect(processed["Feature"]["Proposed"].wips).toBe(1);
        expect(processed["Feature"]["Proposed"].limit).toBe(0);
        expect(processed["Feature"]["Proposed"].flag).toBe(false);
        expect(processed["Feature"]["In-Progress"]).toBeDefined();
        expect(processed["Feature"]["In-Progress"].wips).toBe(1);
        expect(processed["Feature"]["In-Progress"].limit).toBe(2);
        expect(processed["Feature"]["In-Progress"].flag).toBe(false);        
        expect(processed["Feature"]["Accepted"]).toBeDefined();
        expect(processed["Feature"]["Done"]).toBeDefined();
    });
    
    it('renderMarkdown renders valid markdown', async () => {
        let drillIns = [];
        let drillIn = (identifier: string, title: string, cards: IssueCard[]) => {
            drillIns.push(identifier);
        }

        let processed = wipLimits.process(config, projectData, drillIn) as WipData;
        expect(processed).toBeDefined();
        expect(drillIns.length).toBe(10);

        let markdown = wipLimits.renderMarkdown(projectData, processed);
        expect(markdown).toBeDefined();
        expect(markdown).toContain("### Epic WIP limits");
        expect(markdown).toContain("| In-Progress | [3](./wip-Epic-In-Progress.md) | 2     | 🥵    |");
        expect(markdown).toContain("### Feature WIP limits");
        expect(markdown).toContain("| Done        | [1](./wip-Feature-Done.md)        |       |       |");
    });    
});
