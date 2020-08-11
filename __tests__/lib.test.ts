import * as rptLib from '../project-reports-lib'

import {IssueList, ProjectIssue} from '../project-reports-lib';

let testCards:ProjectIssue[] = [
    <ProjectIssue>{
        number: 1,
        title: 'one',
        labels: [{ name: 'One'}],
        
    },
    <ProjectIssue>{
        number: 2,
        title: 'twothree',
        labels: [{ name: 'Two'}, { name: 'three'}]
    },
    <ProjectIssue>{
        number: 3,
        title: 'other',
        labels: [{ name: 'two'}, { name: '11-dev'}, { name: 'foo:baz'}] 
    },
    <ProjectIssue>{
        number: 4,
        title: 'more',
        labels: [{ name: 'five'}, { name: '13-DEV'}, { name: 'Foo: bar '}]
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

  it('can get count from an upper label', async () => {
    let re = new RegExp("(\\d+)-DEV");
    let count = rptLib.getCountFromLabel(testCards[3], re);

    expect(count).toBe(13);
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

  it('gets string value from label with casing and spaces', async () => {
    let re = new RegExp("(?<=Foo:).*");
    let val = rptLib.getStringFromLabel(testCards[3], re);
    expect(val).toBe('bar');
  });
  
  let card = <ProjectIssue>{
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
    expect(d.toISOString()).toBe('2020-07-23T03:31:35.918Z')
  });  

  it('does not gets last comment for no match', async () => {
    let d = rptLib.getLastCommentPattern(card, "^(#){1,4} none match");
    expect(d).toBeFalsy();
  });

  it('does not gets last comment if no comments', async () => {
    let d = rptLib.getLastCommentPattern(<ProjectIssue>{comments:[]}, "^(#){1,4} update");
    expect(d).toBeFalsy();
  });  

  it('gets last comment updated_at value from dataFromCard', async () => {
    let d = rptLib.dataFromCard(card, "LastCommentPattern", "^(#){1,4} update");
    expect(d.toISOString()).toBe('2020-07-23T03:31:35.918Z');
  });
  
  it('depdupes distinct items', async () => {
    let set = new IssueList(issue => issue.number);
    expect(set).toBeDefined();
    expect(set.getItems().length).toBe(0);

    let added = set.add({name: "one", number: 1});
    expect(added).toBeTruthy();
    expect(set.getItems().length).toBe(1);

    added = set.add({name: "two", number: 2});
    expect(added).toBeTruthy();
    expect(set.getItems().length).toBe(2);

    added = set.add({name: "dupe", number: 1});
    expect(added).toBeFalsy();
    expect(set.getItems().length).toBe(2);

    added = set.add([{name: "three", number: 3}, {name: "four", number: 4}, {name: "dupe", number: 1}])
    expect(added).toBeTruthy();
    expect(set.getItems().length).toBe(4);
    
  //   expect(filtered[0].title).toBe('twothree');
  //   expect(filtered[1].title).toBe('other');
  });

  it('depdupes distinct items by url string', async () => {
    let set = new IssueList(issue => `${issue.html_url}`);
    expect(set).toBeDefined();
    expect(set.getItems().length).toBe(0);
    //
    let added = set.add({name: "one", number: 1, html_url: "https://github.com/bryanmacfarlane/quotes-feed/issues/1"});
    expect(added).toBeTruthy();
    expect(set.getItems().length).toBe(1);

    added = set.add({name: "two", number: 1, html_url: "https://github.com/bryanmacfarlane/quotes-feed/issues/2"});
    expect(added).toBeTruthy();
    expect(set.getItems().length).toBe(2);

    added = set.add({name: "dupe", number: 1, html_url: "https://github.com/bryanmacfarlane/quotes-feed/issues/1"});
    expect(added).toBeFalsy();
    expect(set.getItems().length).toBe(2);
    
    // add another with the same id but different url
    added = set.add({name: "other-one", number: 1, html_url: "https://github.com/bryanmacfarlane/sanenode/issues/1"});
    expect(added).toBeTruthy();
    expect(set.getItems().length).toBe(3);
  });  
});
