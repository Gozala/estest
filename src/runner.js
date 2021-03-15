const runner = async api => {
  let { filename, onStart, onEnd, cwd, browser, concurrency, breakOnFail } = api
  const pending = []
  const create = ({ name, fn, filename, parent }) => {
    const test = (name, fn) => create({ name, fn, filename, parent: test })
    test.testName = name

    const _after = []
    const _afterPromises = []
    const after = async () => {
      while (_after.length) {
        const resolve = _after.shift()
        const promise = _afterPromises.shift()
        resolve(test)
        await promise
      }
    }
    test.after = fn => {
      let p = new Promise(resolve => _after.push(resolve))
      if (fn) p = p.then(test => fn(test))
      _afterPromises.push(p)
      return p
    }
    test.fn = async (...args) => {
      await fn(...args)
      after()
    }

    test.filename = filename
    test.parent = parent
    if (parent && pending.indexOf(parent) !== -1) {
      pending.splice(pending.indexOf(parent), 0, test)
    } else {
      pending.push(test)
    }
    return test
  }
  if (!filename) throw new Error('No filename')
  let url
  if (browser) {
    url = new URL(`/_cwd/${filename}`, import.meta.url)
  } else {
    url = new URL(filename, cwd || import.meta.url)
  }
  const module = { ...await import(url) }
  if (!module.default) module.default = module.test
  if (module.default) {
    await module.default((name, fn) => create({ name, fn, filename }))
  } else {
    if (module.tests) {
      for (const [name, fn] of Object.entries(module.tests)) {
        create({ name, fn, filename })
      }
    } else {
      throw new Error('This module does not export anything regonizable as a test')
    }
  }

  concurrency = module.concurrency || concurrency || 100

  if (pending.length === 0) throw new Error('No tests!')
  let start = 0
  const _run = async node => {
    await onStart(node)
    let threw = true
    try {
      await node.fn(node)
      threw = false
    } catch (e) {
      await node.onFail(e)
      if (breakOnFail) process.exit(1)
    }
    if (!threw) await node.onPass()
    await onEnd(node)
    pending.splice(pending.indexOf(node), 1)
    start--
  }
  const running = []
  const wrap = node => {
    const p = _run(node)
    running.push(p)
    p.then(() => running.splice(running.indexOf(p), 1))
  }
  while (pending.length || running.length) {
    pending.slice(start, concurrency).forEach(wrap)
    start += concurrency
    await Promise.race(running)
    concurrency = 1
  }
}

export default runner
