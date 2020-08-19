import * as core from '@actions/core'
import {generate} from './generator'

async function run() {
  try {
    const token = core.getInput('token', {required: true})
    const configPath = core.getInput('configPath', {required: true})

    console.log(`Generating reports for ${configPath} ...`)

    await generate(token, configPath)
  } catch (err) {
    console.error(err)
    core.setFailed(err.message)
  }
}

run()
