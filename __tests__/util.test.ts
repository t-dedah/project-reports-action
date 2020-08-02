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

    it('depdupes distinct items by url string', async () => {
      let set = new DistinctSet(issue => `${issue.html_url}`);
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