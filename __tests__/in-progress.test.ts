import {ProjectIssue} from '../interfaces';
import * as inProgress from '../reports/in-progress';
import {ProgressData, IssueCardEx} from '../reports/in-progress';

let projectData: ProjectIssue[] = require('./project-data.test.json');

let config: any = {
    "report-on": 'Epic',
    // TODO: implement getting a shapshot of data n days ago
    "daysAgo": 7,
    "status-label-match": "(?<=status:).*",
    "wip-label-match": "(\\d+)-dev",
    "last-updated-days-flag": 3.0,
    "last-updated-scheme": "LastCommentPattern", 
    "last-updated-scheme-data": "^(#){1,4} update",   
  };

describe('project-in-progress', () => {

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

    it('process returns InProgressData', async () => {
        let drillIns = [];
        let drillIn = (identifier: string, title: string, cards: ProjectIssue[]) => {
            drillIns.push(identifier);
        }

        let processed = inProgress.process(config, projectData, drillIn) as ProgressData;
        // console.log(JSON.stringify(processed, null, 2));

        expect(processed).toBeDefined();
        expect(processed.cardType).toBe('Epic');

        let cards: IssueCardEx[] = processed.cards;
        expect(cards.length).toBe(4);

        // spot check a card
        expect(cards[0]).toBeDefined();
        expect(cards[0].title).toBe("gRPC generation");
        expect(cards[0].wips).toBe(0);
        expect(cards[0].hoursLastUpdated).toBe(-1);
        expect(cards[0].hoursInProgress).toBeGreaterThan(120);

        expect(cards[1]).toBeDefined();
        expect(cards[1].title).toBe("Initial Web UI");
        expect(cards[1].wips).toBe(1);
        expect(cards[1].hoursLastUpdated).toBeGreaterThan(100);
        expect(cards[1].hoursInProgress).toBeGreaterThan(160);
    });
    
    it('renderMarkdown renders valid markdown', async () => {
        let drillIns = [];
        let drillIn = (identifier: string, title: string, cards: ProjectIssue[]) => {
            drillIns.push(identifier);
        }

        let processed = inProgress.process(config, projectData, drillIn) as IssueCardEx[];
        expect(processed).toBeDefined();

        let markdown = inProgress.renderMarkdown([], processed);
        expect(markdown).toBeDefined();
        // console.log(markdown);
        expect(markdown).toContain("## :hourglass_flowing_sand: In Progress Epics");
        expect(markdown).toContain("gRPC generation](https://github.com/bryanmacfarlane/quotes-feed/issues/16)  | :exclamation: | 0     |  :triangular_flag_on_post:");
        expect(markdown).toContain("| [Initial Frontend](https://github.com/bryanmacfarlane/quotes-feed/issues/14) | :green_heart: | 2     |");
    });    
});
