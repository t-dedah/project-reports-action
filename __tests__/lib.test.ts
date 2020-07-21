import * as rptLib from '../project-reports-lib'

import {IssueCard} from '../interfaces';

let testCards:IssueCard[] = [
    <IssueCard>{
        number: 1,
        title: 'one',
        labels: ['One'],
        
    },
    <IssueCard>{
        number: 2,
        title: 'twothree',
        labels: ['Two', 'three']
    },
    <IssueCard>{
        number: 3,
        title: 'other',
        labels: ['two', '11-dev']
    },
    <IssueCard>{
        number: 4,
        title: 'more',
        labels: ['five']
    } 
]

describe('report-lib', () => {

  beforeEach(() => {
  });

  afterEach(() => {

  });

  afterAll(async () => {}, 100000);

  it('finds cards by label', async () => {
    let filtered = rptLib.cardsWithLabel(testCards, 'two')
    expect(filtered).toBeDefined();
    expect(filtered.length).toBe(2);
    expect(filtered[0].title).toBe('twothree');
    expect(filtered[1].title).toBe('other');
  });

  it('does not find cards by non-existant label', async () => {
    let filtered = rptLib.cardsWithLabel(testCards, 'non-existant')
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
});
