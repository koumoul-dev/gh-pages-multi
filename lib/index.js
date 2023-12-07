const path = require('path')
const util = require('util')
const execPromise = util.promisify(require('child_process').exec)
const ncp = util.promisify(require('ncp'))
const { rimraf } = require('rimraf')
const fs = require('fs')
const readdir = util.promisify(fs.readdir)
const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)
const access = util.promisify(fs.access)
const pug = require('pug')
const tmp = require('tmp-promise')
const GitUrlParse = require('git-url-parse')
const semver = require('semver')
const debug = require('debug')('gh-pages-multi')

exports.deploy = async function ({ src, target, branch, remote, template, title, dryRun, history, betterTarget }) {
  if (betterTarget) target = exports.betterTarget(target)

  debug(`deploy ${src} to ${remote}:${branch}/${target}`)

  const tmpDir = (await tmp.dir({ keep: dryRun })).path

  async function exec (cmd) {
    debug(`Run command: ${cmd}`)
    const res = await execPromise(cmd, { cwd: tmpDir })
    if (res.stdout && res.stdout.length) debug('output=', res.stdout)
    return res.stdout
  }

  // Is the target branch new or already created ?
  const lsOut = await exec(`git ls-remote --heads ${remote} ${branch}`)
  const branchExists = lsOut.indexOf(`refs/heads/${branch}`) !== -1
  if (branchExists) {
    debug(`branch ${branch} exists, clone it.`)
    await exec(`git clone --single-branch -b ${branch} ${remote} ${tmpDir}`)
  } else {
    debug(`branch ${branch} doesn't exist yet, create it.`)
    // Create empty new branch
    await exec(`git clone ${remote} ${tmpDir}`)
    await exec(`git checkout --orphan ${branch}`)
    await exec('git rm -rf .')
  }

  let targetExists
  try {
    await access(path.resolve(tmpDir, target), fs.constants.F_OK)
    targetExists = true
  } catch (err) {
    debug(`${target} does not exist yet`)
    targetExists = false
  }
  if (targetExists) {
    if (!history) {
      debug(`remove all references to ${target} in git history`)
      await exec(`git filter-branch --tree-filter 'rm -rf ${target}' --prune-empty HEAD`)
    }

    debug(`remove previous directory ${target}`)
    await rimraf(path.resolve(tmpDir, target))
  }

  debug(`replace the directory ${target} with new content from ${src}`)
  await ncp(path.resolve(process.cwd(), src), path.resolve(tmpDir, target))

  debug(`create index.html file that lists the directories in branch ${branch} from template ${template}`)
  const dirs = (await readdir(tmpDir)).filter(dir => dir.indexOf('.') !== 0 && dir !== 'index.html').sort()
  const compiledTemplate = pug.compile(await readFile(template, 'utf8'))
  const fullTemplatePath = path.resolve(tmpDir, 'index.html')
  await writeFile(fullTemplatePath, compiledTemplate({ dirs, title }))
  debug(`written ${fullTemplatePath}`)
  const noJekyllPath = path.resolve(tmpDir, '.nojekyll')
  await writeFile(noJekyllPath, '')
  debug(`written ${noJekyllPath}`)

  // Push everything
  if (dryRun) {
    console.log('Dry run option activated, do not push anything')
  } else {
    await exec('git add -A')
    const diffOut = await exec('git diff --staged --name-only')
    if (diffOut.length === 0) return console.log('No modification to validate')
    await exec(`git commit -m "Pushed ${target} by gh-pages-multi"`)
    if (history) await exec(`git push -u origin ${branch}`)
    else await exec(`git push --force -u origin ${branch}`)
    debug(`pushed modifications to ${remote}:${branch}`)
    const gitInfo = GitUrlParse(remote)
    if (gitInfo && gitInfo.source === 'github.com') {
      console.log(`Result should be available here soon: https://${gitInfo.owner}.github.io/${gitInfo.name}/`)
    } else {
      console.log(`Directory ${src} was pushed to ${remote}:${branch}/${target}`)
    }
  }
}

exports.betterTarget = function (target) {
  const version = semver.coerce(target)
  if (version) return version.major + '.' + version.minor
  return target
}
