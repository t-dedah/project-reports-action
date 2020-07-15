import * as core from '@actions/core'
import {generate} from "./generator"
import {ReportSnapshot} from './interfaces'

async function run() {
    try {
        let token = core.getInput('token', { required: true });
        let configPath = core.getInput('configPath', { required: true });
    
        await generate(token, configPath);
    }
    catch (err) {
        core.setFailed(err.message)
    }
}

run()
