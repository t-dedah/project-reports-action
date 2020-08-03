import {ProjectIssue} from '../interfaces';
import * as limits from '../reports/limits';
import {WipData} from '../reports/limits';

let projectData: ProjectIssue[] = require('./project-data.test.json');

let config: any = {
    'report-on-label': 'Epic',
    'proposed-limit': 2,
    "accepted-limit": 2,
    'in-progress-limit': 2,
    'done-limit': 100,
    'count-label-match': '(\\d+)-dev'
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
        expect(projectData.length).toBe(14);
    });

    it('process returns WipData', async () => {
        let drillIns = [];
        let drillIn = (identifier: string, title: string, cards: ProjectIssue[]) => {
            drillIns.push(identifier);
        }

        let processed = limits.process(config, projectData, drillIn) as WipData;
        //console.log(JSON.stringify(processed, null, 2));

        let data = processed.data;
        expect(processed).toBeDefined();
        expect(data).toBeDefined();
        // expect(processed["Epic"]).toBeDefined();
        expect(data["Proposed"]).toBeDefined();
        expect(data["Proposed"].wips).toBe(0);
        expect(data["Proposed"].limit).toBe(2);
        expect(data["Proposed"].flag).toBe(false);
        expect(data["In-Progress"]).toBeDefined();
        expect(data["In-Progress"].wips).toBe(5);
        expect(data["In-Progress"].limit).toBe(2);
        expect(data["In-Progress"].flag).toBe(true);
        expect(data["Accepted"]).toBeDefined();
        expect(data["Done"]).toBeDefined();
    });
    
    it('renderMarkdown renders valid markdown', async () => {
        let drillIns = [];
        let drillIn = (identifier: string, title: string, cards: ProjectIssue[]) => {
            drillIns.push(identifier);
        }

        let processed = limits.process(config, projectData, drillIn) as WipData;
        expect(processed).toBeDefined();
        expect(drillIns.length).toBe(4);

        let markdown = limits.renderMarkdown([], processed);
        expect(markdown).toBeDefined();
        expect(markdown).toContain("## :ship: Epic Limits");
        expect(markdown).toContain("| In-Progress | [5](./limits-Epic-In-Progress.md)  :triangular_flag_on_post: | 2     |");
    });    
});
