import {HttpsProxyAgent} from 'https-proxy-agent'
import {IStore} from './store'

export {FileSystemStore} from './store'

export function wrap(store: IStore) {
  return async (request, options) => {
    // only cache GET requests
    if (options.method !== 'GET') {
      return request
    }

    if (process.env['https_proxy']) {
      options.request = {agent: new HttpsProxyAgent(process.env['https_proxy'])}
    }

    //
    // check whether in cache. if so, return the etag
    //
    const etag = await store.check(options)

    if (etag) {
      options.headers['If-None-Match'] = etag
    }

    // make the request.
    let response
    let fromCache = false
    try {
      response = await request(options)
      process.stdout.write(` [${response.status}]`)
    } catch (err) {
      if (err.status === 304 && etag) {
        console.log(' [304, cache]')
        response = await store.read(request, options)
        fromCache = true
      } else {
        throw err
      }
    }

    if (!fromCache) {
      console.log(
        `rate : ${response.headers['x-ratelimit-remaining']}/${response.headers['x-ratelimit-limit']}`
      )
      await store.write(response, options)
    }

    return response
  }
}
