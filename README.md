# gh-pages-multi

Simply push files to gh-pages on github and manage subdirectories. Easy way to publish documentation for multiple versions of a project for example.

    npm i -g gh-pages-multi

## Examples

Check out the [gh-pages publication for this repo](https://albanm.github.io/gh-pages-multi/) as an example of generated index.html.

Push the 'docs' directory into the gh-pages branch of the current repository in a 'latest' subdirectory.

    gh-pages-multi deploy

Push the 'dist' directory into the gh-pages branch of the current repository in a 'v1.0.0' subdirectory.

    gh-pages-multi deploy -s dist -t v1.0.0

Push the 'docs' directory into the gh-pages branch of the current repository in a 'latest' subdirectory, and erase all previous history concerning 'latest'. Very useful to prevent bloating the git repo if the pushed content contains built files for example.

    gh-pages-multi deploy --no-history

Show help.

    gh-pages-multi --help
    gh-pages-multi deploy --help
