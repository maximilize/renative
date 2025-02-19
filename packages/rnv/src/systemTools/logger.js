import _chalk from 'chalk';

const _chalkCols = {
    white: v => v,
    green: v => v,
    red: v => v,
    yellow: v => v,
    default: v => v,
    gray: v => v,
    blue: v => v,
    magenta: v => v,
};
const _chalkMono = {
    ..._chalkCols,
    bold: _chalkCols
};

let chalk = _chalk;


const RNV_START = '🚀 ReNative';
let RNV = 'ReNative';
const LINE = chalk.bold.white('----------------------------------------------------------');
const LINE2 = chalk.gray('----------------------------------------------------------');


export const logWelcome = () => {
    let str = _defaultColor(`
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│        ${chalk.red('██████╗')} ███████╗${chalk.red('███╗   ██╗')} █████╗ ████████╗██╗${chalk.red('██╗   ██╗')}███████╗       │
│        ${chalk.red('██╔══██╗')}██╔════╝${chalk.red('████╗  ██║')}██╔══██╗╚══██╔══╝██║${chalk.red('██║   ██║')}██╔════╝       │
│        ${chalk.red('██████╔╝')}█████╗  ${chalk.red('██╔██╗ ██║')}███████║   ██║   ██║${chalk.red('██║   ██║')}█████╗         │
│        ${chalk.red('██╔══██╗')}██╔══╝  ${chalk.red('██║╚██╗██║')}██╔══██║   ██║   ██║${chalk.red('╚██╗ ██╔╝')}██╔══╝         │
│        ${chalk.red('██║  ██║')}███████╗${chalk.red('██║ ╚████║')}██║  ██║   ██║   ██║${chalk.red(' ╚████╔╝ ')}███████╗       │
│        ${chalk.red('╚═╝  ╚═╝')}╚══════╝${chalk.red('╚═╝  ╚═══╝')}╚═╝  ╚═╝   ╚═╝   ╚═╝${chalk.red('  ╚═══╝  ')}╚══════╝       │
│                                                                              │
`);

    if (_c?.files?.rnvPackage?.version) {
        _c.rnvVersion = _c.files.rnvPackage.version;
        str += printIntoBox(`      Version: ${chalk.green(_c.rnvVersion)}`, 1);
    }
    str += printIntoBox(`      ${chalk.blue('https://renative.org')}`, 1);
    str += printIntoBox(`      🚀 ${chalk.yellow('Firing up!...')}`, 1);
    str += printIntoBox(`      ${_getCurrentCommand()}`);
    if (_c?.timeStart) str += printIntoBox(`      Start Time: ${_c.timeStart.toLocaleString()}`);
    str += printIntoBox('');
    str += printBoxEnd();
    str += '\n';

    console.log(str);
};

let _messages;
let _currentCommand;
let _currentProcess;
let _isInfoEnabled = false;
let _c;
let _isMono = false;
let _defaultColor;
let _highlightColor;

export const configureLogger = (c, process, command, subCommand, isInfoEnabled) => {
    _messages = [];
    _c = c;
    _c.timeStart = new Date();
    _currentProcess = process;
    _currentCommand = command;
    _currentSubCommand = subCommand;
    _isInfoEnabled = isInfoEnabled;
    _isMono = c.program.mono;
    if (_isMono) {
        chalk = _chalkMono;
    }
    _updateDefaultColors();
    RNV = _getCurrentCommand();
};

const _updateDefaultColors = () => {
    _defaultColor = chalk.gray;
    _highlightColor = chalk.green;
};

export const logAndSave = (msg, skipLog) => {
    if (_messages && !_messages.includes(msg)) _messages.push(msg);
    if (!skipLog) console.log(`${msg}`);
};

const _getCurrentCommand = () => {
    const argArr = _c.process.argv.slice(2);
    return `$ rnv ${argArr.join(' ')}`;
};

export const logSummary = () => {
    let logContent = printIntoBox('All good as 🦄 ');
    if (_messages && _messages.length) {
        logContent = '';
        _messages.forEach((m) => {
            logContent += `│ ${m}\n`;
        });
    }


    let timeString = '';
    if (_c) {
        _c.timeEnd = new Date();
        timeString = `| ${_c.timeEnd.toLocaleString()}`;
    }

    let str = printBoxStart(`🚀  SUMMARY ${timeString}`, _getCurrentCommand());
    if (_c) {
        if (_c.files.projectPackage) {
            str += printIntoBox(`Project Name: ${_highlightColor(_c.files.projectPackage.name)}`, 1);
            str += printIntoBox(`Project Version: ${_highlightColor(_c.files.projectPackage.version)}`, 1);
        }
        if (_c.files.appConfigFile) {
            str += printIntoBox(`App Config: ${_highlightColor(_c.files.appConfigFile.id)}`, 1);
        }
        if (_c.files.projectConfig) {
            const defaultProjectConfigs = _c.files.projectConfig.defaultProjectConfigs;
            if (defaultProjectConfigs.supportedPlatforms) {
                str += printArrIntoBox(defaultProjectConfigs.supportedPlatforms, 'Supported Platfroms: ');
            }
            if (defaultProjectConfigs.template) {
                str += printIntoBox(`Master Template: ${_highlightColor(defaultProjectConfigs.template)}`, 1);
            }
        }
        if (_c.process) {
            const envString = `${_c.process.platform} | ${_c.process.arch} | node v${_c.process.versions?.node} | rnv v${_c.rnvVersion}`;
            str += printIntoBox(`Env Info: ${chalk.gray(envString)}`, 1);
        }

        if (_c.program.scheme) str += printIntoBox(`Build Scheme: ${_highlightColor(_c.program.scheme)}`, 1);
        if (_c.platform) str += printIntoBox(`Platform: ${_highlightColor(_c.platform)}`, 1);
        if (_c.timeEnd) {
            str += printIntoBox(`Executed Time: ${chalk.yellow(_msToTime(_c.timeEnd - _c.timeStart))}`, 1);
        }
    }

    str += printIntoBox('');
    str += logContent;
    str += printIntoBox('');
    str += printBoxEnd();

    console.log(str);
};

const _msToTime = (s) => {
    const ms = s % 1000;
    s = (s - ms) / 1000;
    const secs = s % 60;
    s = (s - secs) / 60;
    const mins = s % 60;
    const hrs = (s - mins) / 60;

    return `${hrs}h:${mins}m:${secs}s:${ms}ms`;
};

export const setCurrentJob = (job) => {
    _currentCommand = job;
};

export const logTask = (task, customChalk) => {
    const ch = customChalk || chalk.green;
    console.log(ch(`${RNV} - ${task} - Starting!`));
};

export const logWarning = (msg) => {
    logAndSave(chalk.yellow(`⚠️  ${RNV} - WARNING: ${msg}`));
};

export const logInfo = (msg) => {
    console.log(chalk.magenta(`ℹ️  ${RNV} - NOTE: ${msg}`));
};

export const logDebug = (...args) => {
    if (_isInfoEnabled) console.log.apply(null, args);
};

export const logComplete = (isEnd = false) => {
    console.log(chalk.bold.white(`\n ${RNV} - Done! 🚀`));
    if (isEnd) logEnd(0);
};

export const logSuccess = (msg) => {
    logAndSave(`✅ ${chalk.magenta(msg)}`);
};

export const logError = (e, isEnd = false) => {
    if (e && e.message) {
        logAndSave(chalk.bold.red(`🛑  ${RNV} - ERRROR! ${e.message}\n${e.stack}`), isEnd);
    } else {
        logAndSave(chalk.bold.red(`🛑  ${RNV} - ERRROR! ${e}`), isEnd);
    }
    if (isEnd) logEnd(1);
};

export const logEnd = (code) => {
    logSummary();
    if (_currentProcess) _currentProcess.exit(code);
};

export const logInitialize = () => {
    logWelcome();
    // console.log(
    //     chalk.white(`\n${LINE}\n ${RNV_START} ${chalk.white.bold(`${_currentCommand} ${_currentSubCommand || ''}`)} is firing up! 🔥\n${LINE}\n`),
    // );
};

export const logAppInfo = c => new Promise((resolve, reject) => {
    console.log(chalk.gray(`\n${LINE2}\nℹ️  Current App Config: ${chalk.bold.white(c.files.appConfigFile.id)}\n${LINE2}`));

    resolve();
});

export const printIntoBox = (str2, chalkIntend = 0) => {
    let output = _defaultColor('│  ');
    let endLine = '';
    let intend;
    if (_isMono) {
        intend = 0;
        chalkIntend = 0;
    } else {
        intend = str2 === '' ? 1 : 2;
    }
    for (let i = 0; i < chalkIntend + intend; i++) {
        endLine += '          ';
    }
    endLine += '                                                                               │\n';
    output += _defaultColor(str2);
    const l = output.length - endLine.length;
    output += _defaultColor(endLine.slice(l));
    return output;
};

export const printArrIntoBox = (arr, prefix = '') => {
    let output = '';
    let stringArr = '';
    let i = 0;
    arr.forEach((v) => {
        const l = i === 0 ? 60 - _defaultColor(prefix).length : 60;
        if (stringArr.length > l) {
            if (i === 0 && prefix.length) {
                output += printIntoBox(`${_defaultColor(prefix)}${_highlightColor(stringArr)}`, 2);
            } else {
                output += printIntoBox(_highlightColor(stringArr), 1);
            }

            stringArr = '';
            i++;
        }
        stringArr += `${v}, `;
        // stringArr[i] += `${c.platformDefaults[v].icon} ${chalk.white(v)}, `;
    });
    if (i === 0 && prefix.length) {
        output += printIntoBox(`${_defaultColor(prefix)}${_highlightColor(stringArr.slice(0, -2))}`, 2);
    } else {
        output += printIntoBox(_highlightColor(stringArr.slice(0, -2)), 1);
    }

    return output;
};

export const printBoxStart = (str, str2) => {
    let output = _defaultColor('┌──────────────────────────────────────────────────────────────────────────────┐\n');
    output += printIntoBox(str);
    output += printIntoBox(str2);
    output += _defaultColor('├──────────────────────────────────────────────────────────────────────────────┤\n');
    return output;
};

export const logStatus = () => {
    // let str = printBoxStart('🚀  STATUS');
    // // str += printIntoBox('SHlelelele euheu ehhh');
    // // console.log('SSKJJSKL', _c);
    // if (_c) {
    //     if (_c.appId) str += printIntoBox(`App Config: ${_highlightColor(_c.appId)}`, 1);
    //     if (_c.program.scheme) str += printIntoBox(`Build Scheme: ${_highlightColor(_c.program.scheme)}`, 1);
    //     if (_c.platform) str += printIntoBox(`Platform: ${_highlightColor(_c.platform)}`, 1);
    // }
    //
    // str += printIntoBox('');
    // str += printBoxEnd();

    // console.log(str);
};

export const printBoxEnd = () => _defaultColor('└──────────────────────────────────────────────────────────────────────────────┘');
