#!/usr/bin/env node

'use strict';

const path = require('path');
const Bytenode = require('./index.js');
const spawnSync = require('child_process').spawnSync;

const args = process.argv.slice(2);

if (args.includes('-h')) {
  args[args.indexOf('-h')] = '--help';
}

if (args.includes('-v')) {
  args[args.indexOf('-v')] = '--version';
}

if (args.includes('-c')) {
  args[args.indexOf('-c')] = '--compile';
}

if (args.includes('-n')) {
  args[args.indexOf('-n')] = '--no-module';
}

if (args.includes('-l')) {
  args[args.indexOf('-l')] = '--loader';
}

const program = {
  dirname: __dirname,
  filename: __filename,
  nodeBin: process.argv[0],
  args: args,
  flags: args.filter(arg => arg[0] === '-'),
  files: args.filter(arg => arg[0] !== '-' && arg[1] !== '-')
};

if (program.flags.includes('--use')) {
  const nextParam = program.args[program.args.indexOf('--use') + 1];

  if (nextParam == null || nextParam.startsWith('-')) {
    console.error('--use flag expects the next argument to be the ' +
      'path of node, electron or nwjs executable.');
    process.exit(1);
  }

  try {
    program.args.splice(program.args.indexOf('--use'), 2);

    spawnSync(nextParam, [
      program.filename,
      ...program.args
    ], {
      stdio: 'inherit',
      env: {
        ELECTRON_RUN_AS_NODE: '1'
      }
    });

    process.exit();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
} else if (program.files.length === 0 && program.flags.length === 1) {
  if (program.flags.includes('--help')) {
    console.log(`
    Usage: bytenode [option] [ FILE... | - ] [arguments]

    Options:
      -h, --help                        show help information.
      -v, --version                     show Bytenode version.
  
          --use     [ EXECUTABLE ]      use this executable instead of the default Node.js.
                                        Electron and NW.js executables can be used.
  
      -c, --compile [ FILE... | - ]     compile stdin, a file, or a list of files.
      -n, --no-module                   compile without producing commonjs module.
  
      -l, --loader  [ FILE | PATTERN ]  create a loader file and optionally define
                                        loader filename or pattern using % as filename replacer.
                                        defaults to %.loader.js
  
    Examples:
  
    $ bytenode -c script.js             compile \`script.js\` to \`script.jsc\`.
    $ bytenode -c src/*.js              compile all \`.js\` files in \`src/\` directory.
  
    $ bytenode -c ./*.js -l %.load.js   create \`filename.load.js\` loader files alongside \`.jsc\` files
  
    $ bytenode script.jsc [arguments]   run \`script.jsc\` with arguments.

    $ bytenode                          open Node REPL where \`.jsc\` files can be required directly.
  
    $ echo 'console.log("Hello");' | bytenode --compile - > hello.jsc
                                        compile from stdin and save to \`hello.jsc\`.
  
    $ bytenode -c main.js --use ./node_modules/electron/dist/electron
                                        use electron executable to compile \`main.js\`.

    $ bytenode -c main.js --use ./node_modules/nw/nwjs/nw
                                        use NW.js executable to compile \`main.js\`.`);

    process.exit();
  }

  if (program.flags.includes('--version')) {
    const pkg = require('../package.json');
    console.log('Bytenode', pkg.version, '| Node', process.versions.node);
    // TODO show electron version, and nwjs version if possible.
    process.exit();
  }
} else if (program.flags.includes('--compile')) {
  const compileAsModule = !program.flags.includes('--no-module');

  let nextParam;

  let loaderPattern;
  const createLoader = program.flags.includes('--loader');
  nextParam = program.args[program.args.indexOf('--loader') + 1];

  if (createLoader && nextParam && !nextParam.startsWith('-')) {
    loaderPattern = nextParam;
    program.files.splice(program.files.indexOf(nextParam));
  }

  let output;
  const createOutput = program.flags.includes('--output');
  nextParam = program.args[program.args.indexOf('--output') + 1];

  if (createOutput && nextParam && !nextParam.startsWith('-')) {
    output = nextParam;
    program.files.splice(program.files.indexOf(nextParam));
  }

  if (program.files.length > 1) {
    try {
      const filename = program.files[0];

      Bytenode.compile({
        filename,
        compileAsModule,
        createLoader,
        loaderPattern,
        output
      });
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  } else {
    try {
      const results = Bytenode.compileFiles({
        files: program.files,
        compileAsModule,
        createLoader,
        loaderPattern,
        output
      });

      results
        .filter(result => result.startsWith('Error:'))
        .forEach(console.error);
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  }

  if (program.flags.includes('-')) {
    let filename;

    if (program.args.includes('--filename')) {
      const nextParam = program.args[program.args.indexOf('--filename') + 1];

      if (nextParam && !nextParam.startsWith('-')) {
        filename = nextParam;
      }
    }

    let code = '';

    process.stdin.setEncoding('utf-8');

    process.stdin.on('data', (chunk) => {
      if (chunk !== null) {
        code += chunk;
      }
    });

    process.stdin.on('end', () => {
      try {
        process.stdout.write(Bytenode.compileCode({
          code,
          filename,
          compileAsModule
        }));

        process.exit();
      } catch (error) {
        console.error(error.message);
        process.exit(1);
      }
    });
  } else {
    process.exit();
  }
} else {
  try {
    spawnSync(program.nodeBin, [
      '-r',
      path.resolve(program.dirname, 'index.js')
    ].concat(args), {
      stdio: 'inherit'
    });
    process.exit();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
