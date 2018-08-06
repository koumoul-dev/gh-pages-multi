#!/usr/bin/env node

const path = require('path')
const program = require('commander')

const packageInfo = require('../package')
const remote = require('remote-origin-url').sync()

program
  .version(packageInfo.version)

program
  .command('deploy')
  .description('Push a directory from your fs into a directory of a remote git branch. Also build index.html listing the directories in the branch.')
  .option('-s, --src [src]', 'The source directory to copy into the remote branch.', 'docs')
  .option('-t, --target [target]', 'The target directory that will be created or overwritten in the remote branch.', 'latest')
  .option('-r, --remote [remote]', 'The remote git repository to push to.', remote)
  .option('-b, --branch [branch]', 'The branch to push to. WARNING: this branch history will be overwritten.', 'gh-pages')
  .option('--template [template]', 'The pug template to use to generate the index.hml file.', path.join(__dirname, '../lib/index.pug'))
  .option('--title [title]', 'The title of the generated index.html.', remote ? remote.split('/').pop().replace('.git', '') : 'gh-pages-multi')
  .option('--no-history', 'Erase the history of the modified directory. Useful when re-creating multiple times a quite large directory with built files for example.')
  .option('--better-target', 'Try to improve the target directory passed as --target parameter if target looks like a branch/tag name. "master" becomes "latest", "1.1.0" becomes "1.x", etc.')
  .option('--dry-run', 'Keep the cloned repository instead of cleaning it and do not push result to remote.')
  .option('-v, --verbose')
  .action(function (options) {
    if (options.dryRun) options.verbose = true
    if (options.verbose) process.env.DEBUG = process.env.DEBUG ? process.env.DEBUG + ',gh-pages-multi' : 'gh-pages-multi'
    require('../lib').deploy(options).then(cb, cbError)
  })

program.command('better-target <target>')
  .description('Return a target directory name proposition based on a branch/tag name. Same policy as the --better-target option of the deploy command.')
  .action(function (target) {
    console.log(require('../lib').betterTarget(target))
  })

if (!process.argv.slice(2).length) program.help()

program.parse(process.argv)

function cb () {
  process.exit()
}

function cbError (err) {
  console.error(err)
  process.exit(1)
}
