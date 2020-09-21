import * as rptLib from '../project-reports-lib'
import {IssueList, ProjectIssue} from '../project-reports-lib'
import projectData from './project-data.test.json'

const testCards: ProjectIssue[] = [
  <ProjectIssue>{
    number: 1,
    title: 'one',
    labels: [{name: 'One'}]
  },
  <ProjectIssue>{
    number: 2,
    title: 'twothree',
    labels: [{name: 'Two'}, {name: 'three'}]
  },
  <ProjectIssue>{
    number: 3,
    title: 'other',
    labels: [{name: 'two'}, {name: '11-dev'}, {name: 'foo:baz'}]
  },
  <ProjectIssue>{
    number: 4,
    title: 'more',
    labels: [{name: 'five'}, {name: '13-DEV'}, {name: 'Foo: bar '}]
  }
]

describe('report-lib', () => {
  it('fuzzy matches column names', async () => {
    // fuzzy match
    //                        are in this <== all these "words"
    expect(rptLib.fuzzyMatch('In progress', 'In progress')).toBeTruthy()
    expect(rptLib.fuzzyMatch('In progress', ' IN Progress.')).toBeTruthy()
    expect(rptLib.fuzzyMatch('In-Progress: A Category', 'in Progress')).toBeTruthy()
    expect(rptLib.fuzzyMatch(' In-Progress 👩🏼‍💻👨🏽‍💻 ', 'in progress!')).toBeTruthy()
    expect(rptLib.fuzzyMatch('\tIn-Progress 👩🏼‍💻 ', ' in...progress👨🏽‍💻')).toBeTruthy()

    // should not fuzzy match
    //                     are not in this <== all these "words"
    expect(rptLib.fuzzyMatch('Into progress', 'In progress')).toBeFalsy
    expect(rptLib.fuzzyMatch('In progress', 'Into progress')).toBeFalsy
    expect(rptLib.fuzzyMatch('pre progress', 'In progress')).toBeFalsy
  })

  it('finds cards by label', async () => {
    const filtered = rptLib.filterByLabel(testCards, 'two')
    expect(filtered).toBeDefined()
    expect(filtered.length).toBe(2)
    expect(filtered[0].title).toBe('twothree')
    expect(filtered[1].title).toBe('other')
  })

  it('does not find cards by non-existant label', async () => {
    const filtered = rptLib.filterByLabel(testCards, 'non-existant')
    expect(filtered).toBeDefined()
    expect(filtered.length).toBe(0)
  })

  it('can get count from a label', async () => {
    const re = new RegExp('(\\d+)-dev')
    const count = rptLib.getCountFromLabel(testCards[2], re)

    expect(count).toBe(11)
  })

  it('can get count from an upper label', async () => {
    const re = new RegExp('(\\d+)-DEV')
    const count = rptLib.getCountFromLabel(testCards[3], re)

    expect(count).toBe(13)
  })

  it('gets NaN count from card without that label', async () => {
    const re = new RegExp('(\\d+)-dev')
    const count = rptLib.getCountFromLabel(testCards[1], re)

    expect(count).toBeNaN()
  })

  it('can sum a property for a set of cards', async () => {
    const sum = rptLib.sumCardProperty(testCards, 'number')

    expect(sum).toBe(10)
  })

  it('gets empty string value from label with no value', async () => {
    const re = new RegExp('(?<=foo:).*')
    const val = rptLib.getStringFromLabel(testCards[1], re)
    expect(val).toBe('')
  })

  it('gets string value from label', async () => {
    const re = new RegExp('(?<=foo:).*')
    const val = rptLib.getStringFromLabel(testCards[2], re)
    expect(val).toBe('baz')
  })

  it('gets string value from label with casing and spaces', async () => {
    const re = new RegExp('(?<=Foo:).*')
    const val = rptLib.getStringFromLabel(testCards[3], re)
    expect(val).toBe('bar')
  })

  const card = <ProjectIssue>{
    body:
      '\
This is the body \r\n\
\r\n\
 body_key_field: the body key value\r\n\
 ### body key heading \r\n\
 body heading value \r\n\
 \r\n',
    comments: [
      {
        body: '## update 2',
        updated_at: new Date('2020-07-23T03:28:28.950Z')
      },
      {
        body: 'foo',
        updated_at: new Date('2020-07-23T03:29:07.282Z')
      },
      {
        body:
          '\
        This is a comment body \r\n\
        \r\n\
        comment_key_field: the comment value\r\n\
        ### comment key heading \r\n\
        \r\n\
        comment heading value \r\n\
        \r\n'
      },
      {
        body:
          '### Update \r\n\
        \r\n\
        An update message\
        \r\n\
        ### Status\
        \r\n\
        green\
        \r\n\
        ### Some date\
        \r\n\
        2020-09-23'
      },
      {
        body: ' foo: bar '
      },
      {
        body: ' target date : 8-4-20 '
      },
      {
        body:
          '### Update\r\n\r\nSample sentence\r\n\r\n### Projected ship date\r\n\r\n2020-09-01\r\n\r\n### Next\r\n\r\nFoo'
      },
      {
        body: '## update 3',
        updated_at: new Date('2020-07-23T03:31:35.918Z')
      }
    ]
  }

  it('gets last comments date field value from comment heading', async () => {
    const v = rptLib.getLastCommentDateField(card, '### Projected ship date')
    expect(v.getUTCMonth()).toBe(8) // 0 based
    expect(v.getUTCDate()).toBe(1)
    expect(v.getUTCFullYear()).toBe(2020)
  })

  it('gets field value from issue comment body', async () => {
    const v = rptLib.getLastCommentField(card, 'comment_key_field')
    expect(v).toBe('the comment value')
  })

  it('gets field value from issue comment body heading', async () => {
    const v = rptLib.getLastCommentField(card, '### Status')
    expect(v).toBe('green')
  })

  it('gets field value from issue comment body heading with empty lines', async () => {
    const v = rptLib.getLastCommentField(card, '### comment key heading')
    expect(v).toBe('comment heading value')
  })

  it('gets field value from issue body', async () => {
    const v = rptLib.getLastCommentField(card, 'body_key_field')
    expect(v).toBe('the body key value')
  })

  it('gets comment field value from issue body heading', async () => {
    const v = rptLib.getLastCommentField(card, '### body key heading')
    expect(v).toBe('body heading value')
  })

  it('gets last comment updated_at value', async () => {
    const d = rptLib.getLastCommentPattern(card, '^(#){1,4} update')
    expect(d.toISOString()).toBe('2020-07-23T03:31:35.918Z')
  })

  it('does not gets last comment for no match', async () => {
    const d = rptLib.getLastCommentPattern(card, '^(#){1,4} none match')
    expect(d).toBeFalsy()
  })

  it('does not gets last comment if no comments', async () => {
    const d = rptLib.getLastCommentPattern(<ProjectIssue>{comments: []}, '^(#){1,4} update')
    expect(d).toBeFalsy()
  })

  it('gets last comments field value from issue', async () => {
    const v = rptLib.getLastCommentField(card, 'foo')
    expect(v).toBe('bar')
  })

  it('handles no comments for field value from issue', async () => {
    const v = rptLib.getLastCommentField(<ProjectIssue>{comments: []}, 'foo')
    expect(v).toBeFalsy()
  })

  it('handles no comments for field date value from issue', async () => {
    const v = rptLib.getLastCommentDateField(<ProjectIssue>{comments: []}, 'target date')
    expect(v).toBeFalsy()
  })

  it('handles invalid dates for field date value from issue', async () => {
    const v = rptLib.getLastCommentDateField(
      <ProjectIssue>{
        comments: [
          {
            body: ' target date : 13-13-20 '
          }
        ]
      },
      'target date'
    ) as Date

    // invalid still returns an object, it's valueOf is just NaN so you can't check with ! or Falsey
    expect(v.valueOf()).toBe(NaN)
    expect(isNaN(v.valueOf())).toBeTruthy()
  })

  it('handles missing entry for field date value from issue', async () => {
    const v = rptLib.getLastCommentDateField(<ProjectIssue>{comments: [{body: 'some text'}]}, 'target date')

    // a missing value will return null so ! and Falsey work
    expect(!v).toBeTruthy()
  })

  it('gets last comment updated_at value from dataFromCard', async () => {
    const d = rptLib.dataFromCard(card, 'LastCommentPattern', '^(#){1,4} update')
    console.log(d)
    expect(d.toISOString()).toBe('2020-07-23T03:31:35.918Z')
  })

  it('depdupes distinct items', async () => {
    const set = new IssueList(issue => issue.number)
    expect(set).toBeDefined()
    expect(set.getItems().length).toBe(0)

    let added = set.add({name: 'one', number: 1})
    expect(added).toBeTruthy()
    expect(set.getItems().length).toBe(1)

    added = set.add({name: 'two', number: 2})
    expect(added).toBeTruthy()
    expect(set.getItems().length).toBe(2)

    added = set.add({name: 'dupe', number: 1})
    expect(added).toBeFalsy()
    expect(set.getItems().length).toBe(2)

    added = set.add([
      {name: 'three', number: 3},
      {name: 'four', number: 4},
      {name: 'dupe', number: 1}
    ])
    expect(added).toBeTruthy()
    expect(set.getItems().length).toBe(4)

    //   expect(filtered[0].title).toBe('twothree');
    //   expect(filtered[1].title).toBe('other');
  })

  it('depdupes distinct items by url string', async () => {
    const set = new IssueList(issue => `${issue.html_url}`)
    expect(set).toBeDefined()
    expect(set.getItems().length).toBe(0)
    //
    let added = set.add({
      name: 'one',
      number: 1,
      html_url: 'https://github.com/bryanmacfarlane/quotes-feed/issues/1'
    })
    expect(added).toBeTruthy()
    expect(set.getItems().length).toBe(1)

    added = set.add({
      name: 'two',
      number: 1,
      html_url: 'https://github.com/bryanmacfarlane/quotes-feed/issues/2'
    })
    expect(added).toBeTruthy()
    expect(set.getItems().length).toBe(2)

    added = set.add({
      name: 'dupe',
      number: 1,
      html_url: 'https://github.com/bryanmacfarlane/quotes-feed/issues/1'
    })
    expect(added).toBeFalsy()
    expect(set.getItems().length).toBe(2)

    // add another with the same id but different url
    added = set.add({
      name: 'other-one',
      number: 1,
      html_url: 'https://github.com/bryanmacfarlane/sanenode/issues/1'
    })
    expect(added).toBeTruthy()
    expect(set.getItems().length).toBe(3)
  })

  it('can getItem from IssueList', async () => {
    const list = new IssueList(issue => issue.html_url)
    list.add(projectData)
    const issue = list.getItem('https://github.com/bryanmacfarlane/quotes-feed/issues/8')

    expect(issue).toBeDefined()
  })

  it('can getItem asof datetime', async () => {
    const list = new IssueList(issue => issue.html_url)
    list.add(projectData)
    const url = 'https://github.com/bryanmacfarlane/quotes-feed/issues/8'
    let issue = list.getItem(url)

    // latest
    expect(issue).toBeDefined()
    expect(issue.project_proposed_at).toBe('2020-07-14T19:49:10Z')
    expect(issue.project_accepted_at).toBe('2020-07-14T19:54:58Z')
    expect(issue.project_in_progress_at).toBe('2020-07-14T19:59:45Z')
    expect(issue.project_done_at).toBe('2020-07-14T21:14:27Z')
    expect(issue.project_added_at).toBe('2020-07-14T19:49:10Z')
    expect(issue.closed_at).toBe('2020-07-20T18:38:51.000Z')
    expect(issue.project_stage).toBe('Done')

    // became issue, proposed: 2020-07-14T19:49:10Z
    // get at that time
    issue = list.getItemAsof(url, '2020-07-14T19:49:10Z')
    expect(issue.project_stage).toBe('Proposed')
    expect(issue.project_proposed_at).toBe('2020-07-14T19:49:10Z')
    expect(issue.project_accepted_at).toBeFalsy()
    expect(issue.project_in_progress_at).toBeFalsy()
    expect(issue.project_done_at).toBeFalsy()
    expect(issue.closed_at).toBeFalsy()
    expect(issue.labels.length).toBe(0)

    // accepted: 2020-07-14T19:49:19Z
    // get slightly after that time
    issue = list.getItemAsof(url, '2020-07-14T19:49:20Z')
    expect(issue.project_stage).toBe('Accepted')
    expect(issue.project_proposed_at).toBe('2020-07-14T19:49:10Z')
    expect(issue.project_accepted_at).toBe('2020-07-14T19:49:19Z')
    expect(issue.project_in_progress_at).toBeFalsy()
    expect(issue.project_done_at).toBeFalsy()
    expect(issue.closed_at).toBeFalsy()
    expect(issue.labels.length).toBe(0)

    // back to proposed: 2020-07-14T19:49:36Z
    issue = list.getItemAsof(url, new Date('2020-07-14T19:49:36Z'))
    expect(issue.project_stage).toBe('Proposed')
    // original proposed date
    expect(issue.project_proposed_at).toBe('2020-07-14T19:49:10Z')
    expect(issue.project_accepted_at).toBeFalsy()
    expect(issue.project_in_progress_at).toBeFalsy()
    expect(issue.project_done_at).toBeFalsy()
    expect(issue.closed_at).toBeFalsy()
    expect(issue.labels.length).toBe(0)

    // back to accepted: 2020-07-14T19:54:58Z
    issue = list.getItemAsof(url, new Date('2020-07-14T19:54:58Z'))
    expect(issue.project_stage).toBe('Accepted')
    expect(issue.project_proposed_at).toBe('2020-07-14T19:49:10Z')
    expect(issue.project_accepted_at).toBe('2020-07-14T19:54:58Z')
    expect(issue.project_in_progress_at).toBeFalsy()
    expect(issue.project_done_at).toBeFalsy()
    expect(issue.closed_at).toBeFalsy()
    expect(issue.labels.length).toBe(0)

    // in-progress: 2020-07-14T19:59:45Z
    // get exact as Date
    issue = list.getItemAsof(url, new Date('2020-07-14T19:59:45Z'))
    expect(issue.project_stage).toBe('In-Progress')
    expect(issue.project_proposed_at).toBe('2020-07-14T19:49:10Z')
    expect(issue.project_accepted_at).toBe('2020-07-14T19:54:58Z')
    expect(issue.project_in_progress_at).toBe('2020-07-14T19:59:45Z')
    expect(issue.project_done_at).toBeFalsy()
    expect(issue.closed_at).toBeFalsy()
    expect(issue.labels.length).toBe(0)

    // done: 2020-07-14T21:14:27Z
    // data slightly after
    issue = list.getItemAsof(url, new Date('2020-07-14T21:15:00Z'))
    expect(issue.project_stage).toBe('Done')
    expect(issue.project_proposed_at).toBe('2020-07-14T19:49:10Z')
    expect(issue.project_accepted_at).toBe('2020-07-14T19:54:58Z')
    expect(issue.project_in_progress_at).toBe('2020-07-14T19:59:45Z')
    expect(issue.project_done_at).toBe('2020-07-14T21:14:27Z')
    expect(issue.closed_at).toBeFalsy()
    expect(issue.labels.length).toBe(0)

    // closed: 2020-07-15T04:28:13Z
    issue = list.getItemAsof(url, '2020-07-15T04:28:13Z')
    expect(issue.closed_at).toBe('2020-07-15T04:28:13Z')

    // labeled: feature, 1-dev 2020-07-19T19:38:58Z
    issue = list.getItemAsof(url, '2020-07-19T19:38:58Z')
    expect(issue.labels.length).toBe(2)

    // reopened: 2020-07-20T18:38:28Z
    issue = list.getItemAsof(url, '2020-07-20T18:38:28Z')
    expect(issue.closed_at).toBeFalsy()

    // closed: 2020-07-20T18:38:51Z
    issue = list.getItemAsof(url, '2020-07-20T18:38:51Z')
    expect(issue.closed_at).toBe('2020-07-20T18:38:51Z')
    expect(issue.project_proposed_at).toBe('2020-07-14T19:49:10Z')
    expect(issue.project_accepted_at).toBe('2020-07-14T19:54:58Z')
    expect(issue.project_in_progress_at).toBe('2020-07-14T19:59:45Z')
    expect(issue.project_done_at).toBe('2020-07-14T21:14:27Z')
    expect(issue.project_added_at).toBe('2020-07-14T19:49:10Z')
    expect(issue.project_stage).toBe('Done')
  })
})
