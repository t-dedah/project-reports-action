import * as core from '@actions/core'
import {generate} from "./generator"
import {ReportSnapshot} from './interfaces'

async function run() {
    try {
        let token = core.getInput('token', { required: true });
        let configPath = core.getInput('configPath', { required: true });
    
        let report: ReportSnapshot = await generate(token, configPath);
    
        console.log(JSON.stringify(report, null, 2));
    }
    catch (err) {
        core.setFailed(err.message)
    }
}

run()
