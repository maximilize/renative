/* eslint-disable import/no-cycle */
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import child_process from 'child_process';
import inquirer from 'inquirer';
import net from 'net';

import { execCLI } from '../systemTools/exec';
import { RNV_GLOBAL_CONFIG_NAME } from '../constants';
import {
    logTask,
    logError,
    getAppFolder,
    isPlatformActive,
    logWarning,
    logInfo,
    logDebug,
    logSuccess,
    CLI_TIZEN_EMULATOR,
    CLI_TIZEN,
    CLI_SDB_TIZEN,
    writeCleanFile,
    getAppTemplateFolder,
    copyBuildsFolder,
} from '../common';
import { copyFolderContentsRecursiveSync } from '../systemTools/fileutils';
import { buildWeb } from './web';

const configureTizenGlobal = c => new Promise((resolve, reject) => {
    logTask('configureTizenGlobal');
    // Check Tizen Cert
    // if (isPlatformActive(c, TIZEN) || isPlatformActive(c, TIZEN_WATCH)) {
    const tizenAuthorCert = path.join(c.paths.globalConfigFolder, 'tizen_author.p12');
    if (fs.existsSync(tizenAuthorCert)) {
        console.log('tizen_author.p12 file exists!');
        resolve();
    } else {
        console.log('tizen_author.p12 file missing! Creating one for you...');
        createDevelopTizenCertificate(c)
            .then(() => resolve())
            .catch(e => reject(e));
    }
    // }
});

function launchTizenSimulator(c, name) {
    logTask(`launchTizenSimulator:${name}`);

    if (name) {
        return execCLI(c, CLI_TIZEN_EMULATOR, `launch --name ${name}`);
    }
    return Promise.reject('No simulator -t target name specified!');
}

const copyTizenAssets = (c, platform) => new Promise((resolve, reject) => {
    logTask('copyTizenAssets');
    if (!isPlatformActive(c, platform, resolve)) return;

    const sourcePath = path.join(c.paths.appConfigFolder, 'assets', platform);
    const destPath = path.join(getAppFolder(c, platform));

    copyFolderContentsRecursiveSync(sourcePath, destPath);
    resolve();
});

const createDevelopTizenCertificate = c => new Promise((resolve, reject) => {
    logTask('createDevelopTizenCertificate');

    execCLI(c, CLI_TIZEN, `certificate -- ${c.paths.globalConfigFolder} -a rnv -f tizen_author -p 1234`)
        .then(() => addDevelopTizenCertificate(c))
        .then(() => resolve())
        .catch((e) => {
            logError(e);
            resolve();
        });
});

const addDevelopTizenCertificate = c => new Promise((resolve) => {
    logTask('addDevelopTizenCertificate');

    execCLI(c, CLI_TIZEN, `security-profiles add -n RNVanillaCert -a ${path.join(c.paths.globalConfigFolder, 'tizen_author.p12')} -p 1234`)
        .then(() => resolve())
        .catch((e) => {
            logError(e);
            resolve();
        });
});

const getDeviceID = async (c, target) => {
    const { device } = c.program;
    if (device) {
        const connectResponse = await execCLI(c, CLI_SDB_TIZEN, `connect ${target}`, logTask);
        if (connectResponse.includes('failed to connect to remote target')) throw new Error(connectResponse);
    }

    const devicesList = await execCLI(c, CLI_SDB_TIZEN, 'devices', logTask);
    if (devicesList.includes(target)) {
        const lines = devicesList.trim().split(/\r?\n/);
        const devices = lines.filter(line => line.includes(target));

        if (devices.length > 1) {
            // @todo handle more than one
        }

        const deviceID = devices[0].split('device')[1].trim();
        return deviceID;
    }
    throw `No device matching ${target} could be found.`;
};

const waitForEmulatorToBeReady = (c, emulator) => new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 10;
    const poll = setInterval(() => {
        try {
            const devicesList = child_process.execSync(`${c.cli[CLI_SDB_TIZEN]} devices`).toString();
            const lines = devicesList.trim().split(/\r?\n/);
            const devices = lines.filter(line => line.includes(emulator) && line.includes('device'));
            if (devices.length > 0) {
                clearInterval(poll);
                logDebug('waitForEmulatorToBeReady - boot complete');
                resolve(true);
            } else {
                attempts++;
                console.log(`Checking if emulator has booted up: attempt ${attempts}/${maxAttempts}`);
                if (attempts === maxAttempts) {
                    clearInterval(poll);
                    throw new Error('Can\'t connect to the running emulator. Try restarting it.');
                }
            }
        } catch (e) {
            console.log(`Checking if emulator has booted up: attempt ${attempts}/${maxAttempts}`);
            attempts++;
            if (attempts > maxAttempts) {
                clearInterval(poll);
                throw new Error('Can\'t connect to the running emulator. Try restarting it.');
            }
        }
    }, 2000);
});

const getRunningDevices = async (c) => {
    const devicesList = child_process.execSync(`${c.cli[CLI_SDB_TIZEN]} devices`).toString();
    const lines = devicesList.trim().split(/\r?\n/);
    const devices = [];

    if (lines.length > 1) { // skipping header
        lines.forEach((line) => {
            if (!line.includes('List of devices')) {
                const words = line.replace(/\t/g, '').split('    ');
                if (words.length >= 3) {
                    devices.push({
                        name: words[0].trim(),
                        type: words[1].trim(),
                        id: words[2].trim()
                    });
                }
            }
        });
    }

    return devices;
};

const composeDevicesString = devices => devices.map(device => ({ key: device.id, name: device.name, value: device.id }));

const runTizen = async (c, platform, target) => {
    logTask(`runTizen:${platform}:${target}`);

    const platformConfig = c.files.appConfigFile.platforms[platform];

    if (!platformConfig) {
        throw new Error(`runTizen: ${chalk.blue(platform)} not defined in your ${chalk.white(c.paths.appConfigPath)}`);
    }
    if (!platformConfig.appName) {
        throw new Error(`runTizen: ${chalk.blue(platform)}.appName not defined in your ${chalk.white(c.paths.appConfigPath)}`);
    }

    const tDir = getAppFolder(c, platform);

    const tOut = path.join(tDir, 'output');
    const tBuild = path.join(tDir, 'build');
    const tId = platformConfig.id;
    const gwt = `${platformConfig.appName}.wgt`;
    const certProfile = platformConfig.certificateProfile;


    let deviceID;

    const askForEmulator = async () => {
        const { startEmulator } = await inquirer.prompt([{
            name: 'startEmulator',
            type: 'confirm',
            message: `Could not find or connect to the specified target (${target}). Would you like to start an emulator?`,
        }]);

        if (startEmulator) {
            const defaultTarget = c.files.globalConfig.defaultTargets[platform];
            try {
                await launchTizenSimulator(c, defaultTarget);
                deviceID = defaultTarget;
                await waitForEmulatorToBeReady(c, defaultTarget);
                return continueLaunching();
            } catch (e) {
                logDebug(`askForEmulator:ERRROR: ${e}`);
                try {
                    await execCLI(c, CLI_TIZEN_EMULATOR, `create -n ${defaultTarget} -p tv-samsung-5.0-x86`, logTask);
                    await launchTizenSimulator(c, defaultTarget);
                    deviceID = defaultTarget;
                    await waitForEmulatorToBeReady(c, defaultTarget);
                    return continueLaunching();
                } catch (err) {
                    logDebug(err);
                    logError(`Could not find the specified target and could not create the emulator automatically. Please create one and then edit the default target from ${c.paths.globalConfigFolder}/${RNV_GLOBAL_CONFIG_NAME}`);
                }
            }
        }
    };

    const continueLaunching = async () => {
        let hasDevice = false;

        await configureTizenProject(c, platform);
        await buildWeb(c, platform);
        await execCLI(c, CLI_TIZEN, `build-web -- ${tDir} -out ${tBuild}`, logTask);
        await execCLI(c, CLI_TIZEN, `package -- ${tBuild} -s ${certProfile} -t wgt -o ${tOut}`, logTask);

        try {
            await execCLI(c, CLI_TIZEN, `uninstall -p ${tId} -t ${deviceID}`, logTask);
            hasDevice = true;
        } catch (e) {
            if (e && e.includes && e.includes('No device matching')) {
                await launchTizenSimulator(c, target);
                hasDevice = await waitForEmulatorToBeReady(c, target);
            }
        }
        try {
            await execCLI(c, CLI_TIZEN, `install -- ${tOut} -n ${gwt} -t ${deviceID}`, logTask);
            hasDevice = true;
        } catch (err) {
            logError(err);
            logWarning(
                `Looks like there is no emulator or device connected! Let's try to launch it. "${chalk.white.bold(
                    `rnv target launch -p ${platform} -t ${target}`
                )}"`
            );

            await launchTizenSimulator(c, target);
            hasDevice = await waitForEmulatorToBeReady(c, target);
        }

        if (platform !== 'tizenwatch' && platform !== 'tizenmobile' && hasDevice) {
            await execCLI(c, CLI_TIZEN, `run -p ${tId} -t ${deviceID}`, logTask);
        } else if ((platform === 'tizenwatch' || platform === 'tizenmobile') && hasDevice) {
            const packageID = tId.split('.');
            await execCLI(c, CLI_TIZEN, `run -p ${packageID[0]} -t ${deviceID}`, logTask);
        }
        return true;
    };

    // Check if target is present or it's the default one
    const isTargetSpecified = c.program.target;

    // Check for running devices
    const devices = await getRunningDevices(c);

    if (isTargetSpecified) {
        // The user requested a specific target, searching for it in active ones
        if (net.isIP(target)) {
            deviceID = await getDeviceID(c, target);
            return continueLaunching();
        }

        if (devices.length > 0) {
            const targetDevice = devices.find(device => device.id === target || device.name === target);
            if (targetDevice) {
                deviceID = targetDevice.id;
                return continueLaunching();
            }
        }
        try {
            // try to launch it, see if it's a simulator that's not started yet
            await launchTizenSimulator(c, target);
            await waitForEmulatorToBeReady(c, target);
            deviceID = target;
            return continueLaunching();
        } catch (e) {
            return askForEmulator();
        }
    } else {
        if (devices.length === 1) {
            deviceID = devices[0].id;
            return continueLaunching();
        } if (devices.length > 1) {
            const choices = composeDevicesString(devices);
            const { chosenEmulator } = await inquirer.prompt([{
                name: 'chosenEmulator',
                type: 'list',
                message: 'On what emulator would you like to run the app?',
                choices
            }]);
            deviceID = chosenEmulator;
            return continueLaunching();
        }
        return askForEmulator();
    }
};

const buildTizenProject = (c, platform) => new Promise((resolve, reject) => {
    logTask(`buildTizenProject:${platform}`);

    const platformConfig = c.files.appConfigFile.platforms[platform];
    const tDir = getAppFolder(c, platform);

    const tOut = path.join(tDir, 'output');
    const tBuild = path.join(tDir, 'build');
    const certProfile = platformConfig.certificateProfile;

    configureTizenProject(c, platform)
        .then(() => buildWeb(c, platform))
        .then(() => execCLI(c, CLI_TIZEN, `build-web -- ${tDir} -out ${tBuild}`, logTask))
        .then(() => execCLI(c, CLI_TIZEN, `package -- ${tBuild} -s ${certProfile} -t wgt -o ${tOut}`, logTask))
        .then(() => {
            logSuccess(`Your GWT package is located in ${chalk.white(tOut)} .`);
            return resolve();
        })
        .catch(e => reject(e));
});

const configureTizenProject = (c, platform) => new Promise((resolve, reject) => {
    logTask('configureTizenProject');

    if (!isPlatformActive(c, platform, resolve)) return;

    // configureIfRequired(c, platform)
    //     .then(() => copyTizenAssets(c, platform))
    copyTizenAssets(c, platform)
        .then(() => copyBuildsFolder(c, platform))
        .then(() => configureProject(c, platform))
        .then(() => resolve())
        .catch(e => reject(e));
});

const configureProject = (c, platform) => new Promise((resolve) => {
    logTask(`configureProject:${platform}`);

    const appFolder = getAppFolder(c, platform);

    const configFile = 'config.xml';
    const p = c.files.appConfigFile.platforms[platform];
    writeCleanFile(path.join(getAppTemplateFolder(c, platform), configFile), path.join(appFolder, configFile), [
        { pattern: '{{PACKAGE}}', override: p.package },
        { pattern: '{{ID}}', override: p.id },
        { pattern: '{{APP_NAME}}', override: p.appName },
    ]);

    resolve();
});

export {
    launchTizenSimulator,
    copyTizenAssets,
    configureTizenProject,
    createDevelopTizenCertificate,
    addDevelopTizenCertificate,
    runTizen,
    buildTizenProject,
    configureTizenGlobal,
};
