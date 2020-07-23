import * as rptLib from '../project-reports-lib'

import {IssueCard} from '../interfaces';

let testCards:IssueCard[] = [
    <IssueCard>{
        number: 1,
        title: 'one',
        labels: [{ name: 'One'}],
        
    },
    <IssueCard>{
        number: 2,
        title: 'twothree',
        labels: [{ name: 'two'}, { name: 'three'}]
    },
    <IssueCard>{
        number: 3,
        title: 'other',
        labels: [{ name: 'two'}, { name: '11-dev'}, { name: 'foo:baz'}] 
    },
    <IssueCard>{
        number: 4,
        title: 'more',
        labels: [{ name: 'five'}, { name: 'foo: bar '}]
    } 
]

describe('report-lib', () => {

  beforeEach(() => {
  });

  afterEach(() => {

  });

  afterAll(async () => {}, 100000);

  it('finds cards by label', async () => {
    let filtered = rptLib.filterByLabel(testCards, 'two')
    expect(filtered).toBeDefined();
    expect(filtered.length).toBe(2);
    expect(filtered[0].title).toBe('twothree');
    expect(filtered[1].title).toBe('other');
  });

  it('does not find cards by non-existant label', async () => {
    let filtered = rptLib.filterByLabel(testCards, 'non-existant')
    expect(filtered).toBeDefined();
    expect(filtered.length).toBe(0);
  });
  
  it('can get count from a label', async () => {
    let re = new RegExp("(\\d+)-dev");
    let count = rptLib.getCountFromLabel(testCards[2], re);

    expect(count).toBe(11);
  });

  it('gets NaN count from card without that label', async () => {
    let re = new RegExp("(\\d+)-dev");
    let count = rptLib.getCountFromLabel(testCards[1], re);

    expect(count).toBeNaN();
  }); 
  
  it('can sum a property for a set of cards', async () => {
    let sum = rptLib.sumCardProperty(testCards, "number");

    expect(sum).toBe(10);
  });

  it('gets empty string value from label with no value', async () => {
    let re = new RegExp("(?<=foo:).*");
    let val = rptLib.getStringFromLabel(testCards[1], re);
    expect(val).toBe('');
  });

  it('gets string value from label', async () => {
    let re = new RegExp("(?<=foo:).*");
    let val = rptLib.getStringFromLabel(testCards[2], re);
    expect(val).toBe('baz');
  });

  it('gets string value from label with spaces', async () => {
    let re = new RegExp("(?<=foo:).*");
    let val = rptLib.getStringFromLabel(testCards[3], re);
    expect(val).toBe('bar');
  });
  
  let card = <IssueCard>{
    comments: [{
        body: "## update 2",
        updated_at: new Date('2020-07-23T03:28:28.950Z')
    },{
        body: "foo",
        updated_at: new Date('2020-07-23T03:29:07.282Z')
    },{
        body: "## update 3",
        updated_at: new Date('2020-07-23T03:31:35.918Z')
    }]
  }

  it('gets last comment updated_at value', async () => {
    let d = rptLib.getLastCommentPattern(card, "^(#){1,4} update");
    expect(d).toBe('Wed Jul 22 2020');
  });  

  it('does not gets last comment for no match', async () => {
    let d = rptLib.getLastCommentPattern(card, "^(#){1,4} none match");
    expect(d).toBe('');
  });

  it('does not gets last comment if no comments', async () => {
    let d = rptLib.getLastCommentPattern(<IssueCard>{comments:[]}, "^(#){1,4} update");
    expect(d).toBe('');
  });  

  it('gets last comment updated_at value from dataFromCard', async () => {
    let d = rptLib.dataFromCard(card, "LastCommentPattern", "^(#){1,4} update");
    expect(d).toBe('Wed Jul 22 2020');
  });  
});
