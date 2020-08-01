import {DistinctSet} from '../util';

describe('util', () => {

    beforeEach(() => {
    });
  
    afterEach(() => {
  
    });
  
    afterAll(async () => {}, 100000);
  
    it('depdupes distinct items', async () => {
      let set = new DistinctSet(issue => issue.number);
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
});