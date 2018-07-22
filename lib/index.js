const path = require('path')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const ncp = util.promisify(require('ncp'))
const rimraf = util.promisify(require('rimraf'))
const fs = require('fs')
const readdir = util.promisify(fs.readdir)
const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)
const access = util.promisify(fs.access)
const pug = require('pug')
const tmp = require('tmp-promise')
const debug = require('debug')('gh-pages-multi')

exports.deploy = async function ({src, target, branch, remote, template, title, dryRun, history}) {
  debug(`deploy ${src} to ${remote}:${branch}/${target}`)

  const tmpDir = (await tmp.dir({keep: dryRun})).path
  // Is the target branch new or already created ?
  let res = await exec(`git ls-remote --heads ${remote} ${branch}`)
  const branchExists = res.stdout.indexOf(`refs/heads/${branch}`) !== -1
  if (branchExists) {
    debug(`branch ${branch} exists, clone it.`)
    await exec(`git clone --single-branch -b ${branch} ${remote} ${tmpDir}`)
  } else {
    debug(`branch ${branch} doesn't exist yet, create it.`)
    // Create empty new branch
    await exec(`git clone ${remote} ${tmpDir}`)
    await exec(`git checkout --orphan ${branch}`, {cwd: tmpDir})
    await exec(`git rm -rf .`, {cwd: tmpDir})
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
      await exec(`git filter-branch --tree-filter 'rm -rf ${target}' --prune-empty HEAD`, {cwd: tmpDir})
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
  await writeFile(fullTemplatePath, compiledTemplate({dirs, title}))
  debug(`written ${fullTemplatePath}`)

  // Push everything
  if (!dryRun) {
    if (history) {
      res = await exec(`git diff --name-only`, {cwd: tmpDir})
      if (res.stdout.length === 0) return debug(`no modification to validate`)
    }
    await exec(`git add -A`, {cwd: tmpDir})
    await exec(`git commit -m "Pushed ${target} by gh-pages-multi"`, {cwd: tmpDir})
    if (history) {
      await exec(`git push -u origin ${branch}`, {cwd: tmpDir})
    } else {
      await exec(`git push --force -u origin ${branch}`, {cwd: tmpDir})
    }
    debug(`pushed modifications to ${remote}:${branch}`)
  }
}
