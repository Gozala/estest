#!/bin/sh
':' // comment; exec /usr/bin/env node  --unhandled-rejections=strict "$0" "$@"
import yargs from 'yargs'
import run from './src/cli.js'

const options = yargs => {
  yargs.positional('files', {
    desc: 'Test files you want to run'
  })
  yargs.option('browser', {
    desc: 'Run browser tests',
    type: 'boolean',
    default: false
  })
  yargs.option('break', {
    desc: 'Run test serially until the first break and then stop',
    alias: 'b'
  })
}

const cwd = process.cwd()

const _run = argv => run({
  ...argv,
  stdout: process.stdout,
  cwd: new URL(cwd.startsWith('/') ? `file://${cwd}/` : `file:///${cwd.replace(/\\g/, '/')}/`)
})

/* eslint-disable-next-line */
const argv = yargs.command('$0 [files..]', 'Run test files', options, _run).argv
