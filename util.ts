import * as fs from 'fs'

export function mkdirP(tgtPath: string) {
  if (!fs.existsSync(tgtPath)) {
    fs.mkdirSync(tgtPath, {recursive: true})
  }
}
