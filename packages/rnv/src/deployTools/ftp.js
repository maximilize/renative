import path from 'path';
import fs from 'fs';
import {
    logInfo,
    askQuestion,
    finishQuestion,
    logComplete,
    logError,
    logTask,
} from '../common';
import { RNV_APP_CONFIG_NAME } from '../constants';
import { DEPLOY_TARGET_FTP } from './webTools';

const _deployToFtp = (c, platform) => new Promise((resolve, reject) => {
    logTask(`_deployToFtp:${platform}`);
    let promise;
    const envPath = path.resolve(c.paths.projectRootFolder, '.env');
    if (!fs.existsSync(envPath)) {
        logInfo('.env file does not exist. Creating one for you');
        promise = _createEnvFtpConfig(envPath);
    } else {
        promise = new Promise((resolve, reject) => {
            fs.readFile(envPath, (err, data) => {
                if (err) return reject(err);
                resolve(data.toString());
            });
        });
    }
    promise.then((envContent) => {
        const envObj = {};
        let matches = 0;
        const targetMatches = 2;
        envContent.split('\n').map(line => line.split('=')).forEach(([key, val]) => {
            if (['RNV_DEPLOY_WEB_FTP_SERVER', 'RNV_DEPLOY_WEB_FTP_USER'].indexOf(key) > -1) {
                matches++;
            }
        });
        let envPromise;
        if (matches >= targetMatches) {
            envPromise = Promise.resolve();
        } else {
            logInfo('.env file does not contain all needed FTP config, helping you to set it up');
            envPromise = _createEnvFtpConfig(envPath, `${envContent}\n`);
        }
        return envPromise;
    })
        .then(() => {
            require('dotenv').config();
            const config = {
                user: process.env.RNV_DEPLOY_WEB_FTP_USER,
                password: process.env.RNV_DEPLOY_WEB_FTP_PASSWORD, // optional, prompted if none given
                host: process.env.RNV_DEPLOY_WEB_FTP_SERVER,
                port: process.env.RNV_DEPLOY_WEB_FTP_PORT || 21,
                localRoot: c.files.appConfigFile.platforms[platform].deploy[DEPLOY_TARGET_FTP].localRoot,
                remoteRoot: c.files.appConfigFile.platforms[platform].deploy[DEPLOY_TARGET_FTP].remoteRoot || '/',
                include: c.files.appConfigFile.platforms[platform].deploy[DEPLOY_TARGET_FTP].include || ['*', '**/*'], // this would upload everything except dot files
                exclude: c.files.appConfigFile.platforms[platform].deploy[DEPLOY_TARGET_FTP].exclude || [], // e.g. exclude sourcemaps - ** exclude: [] if nothing to exclude **
                deleteRemote: c.files.appConfigFile.platforms[platform].deploy[DEPLOY_TARGET_FTP].exclude.deleteRemote || false, // delete ALL existing files at destination before uploading, if true
                forcePasv: true // Passive mode is forced (EPSV command is not sent)
            };
            return config;
        })
        .then((config) => {
            const FtpDeploy = require('ftp-deploy');
            const ftpDeploy = new FtpDeploy();
            return ftpDeploy.deploy(config);
        }).catch(reject);
});

const _createEnvFtpConfig = (configFilePath, previousContent = '') => new Promise((resolve, reject) => {
    let envContent = previousContent || '';
    askQuestion('Type your FTP host').then((v) => {
        finishQuestion();
        if (v) {
            envContent += `RNV_DEPLOY_WEB_FTP_SERVER=${v}\n`;
        } else {
            return reject(new Error('NO FTP SERVER PROVIDED'));
        }
        askQuestion('Type your FTP user').then((v) => {
            finishQuestion();
            if (v) {
                envContent += `RNV_DEPLOY_WEB_FTP_USER=${v}\n`;
            } else {
                return reject(new Error('NO FTP USER PROVIDED'));
            }
            askQuestion('Type your FTP password (or press ENTER for prompting every time)').then((v) => {
                finishQuestion();
                if (v) {
                    envContent += `RNV_DEPLOY_WEB_FTP_PASSWORD=${v}\n`;
                }
                askQuestion('Type your FTP port (or enter for 21)').then((v) => {
                    finishQuestion();
                    const port = !v || isNaN(v) ? 21 : v;
                    envContent += `RNV_DEPLOY_WEB_FTP_PORT=${port}`;
                    fs.writeFileSync(configFilePath, envContent);
                    logInfo(`Writing .env config to ${configFilePath}`);
                    resolve();
                });
            });
        });
    });
});

const _createDeployConfig = (c, platform) => new Promise((resolve, reject) => {
    logTask(`_createDeployConfig:${platform}`);

    const configFilePath = path.resolve(
        c.files.projectConfig.appConfigsFolder,
        c.defaultAppConfigId,
        RNV_APP_CONFIG_NAME
    );

    c.files.appConfigFile.platforms[platform].deploy = c.files.appConfigFile.platforms[platform].deploy || {};
    c.files.appConfigFile.platforms[platform].deploy[DEPLOY_TARGET_FTP] = {};
    c.files.appConfigFile.platforms[platform].deploy[DEPLOY_TARGET_FTP].type = DEPLOY_TARGET_FTP;

    const targetConfigPromise = new Promise((resolve, reject) => {
        c.files.appConfigFile.platforms[platform].deploy[DEPLOY_TARGET_FTP].localRoot = path.resolve(c.paths.platformBuildsFolder, `${c.appId}_${platform}`);
        askQuestion('Folder on the ftp to upload the project (default is \'/\')')
            .then((v) => {
                finishQuestion();
                c.files.appConfigFile.platforms[platform].deploy[DEPLOY_TARGET_FTP].remoteRoot = v || '/';
            })
            .then(() => askQuestion('Delete all contents of that folder when deploying versions y/N (default is \'N\')?')
                .then((v) => {
                    finishQuestion();
                    c.files.appConfigFile.platforms[platform].deploy[DEPLOY_TARGET_FTP].deleteRemote = ['yes', 'Y', 'y'].indexOf(v) > -1;
                }))
            .then(() => askQuestion('Included files pattern, comma separated (default \'*\',\'**/*\' = all except dot files)')
                .then((v) => {
                    finishQuestion();
                    c.files.appConfigFile.platforms[platform].deploy[DEPLOY_TARGET_FTP].include = v ? v.split(',') : ['*', '**/*'];
                }))
            .then(() => {
                c.files.appConfigFile.platforms[platform].deploy[DEPLOY_TARGET_FTP].exclude = [];
                return askQuestion('Excluded files pattern, comma separated (default [])')
                    .then((v) => {
                        finishQuestion();
                        c.files.appConfigFile.platforms[platform].deploy[DEPLOY_TARGET_FTP].exclude = v ? v.split(',') : [];
                    });
            })
            .then(() => askQuestion('Exclude sourcemaps? y/N (default = N)')
                .then((v) => {
                    finishQuestion();
                    c.files.appConfigFile.platforms[platform].deploy[DEPLOY_TARGET_FTP].exclude = c.files.appConfigFile.platforms[platform].deploy[DEPLOY_TARGET_FTP].exclude.concat(['yes', 'Y', 'y'].indexOf(v) > -1 ? ['**/*.map'] : []);
                }))
            .then(resolve);
    });

    targetConfigPromise
        .then(() => {
            logInfo(`Setting your appconfig for ${platform} to include deploy type: ${DEPLOY_TARGET_FTP}
                    on ${configFilePath}
                `);
            fs.writeFileSync(configFilePath, JSON.stringify(c.files.appConfigFile, null, 2));
            resolve();
        })
        .catch(reject);
});

const deployToFtp = (c, platform) => new Promise((resolve, reject) => {
    logTask(`checkDeployConfigTarget:${platform}`);
    const targetConfig = c.files.appConfigFile.platforms[platform];
    if (targetConfig && targetConfig.deploy[DEPLOY_TARGET_FTP] && targetConfig.deploy[DEPLOY_TARGET_FTP].type) {
        _deployToFtp(c, platform).then(resolve).catch(reject);
    } else {
        _createDeployConfig(c, platform)
            .then(() => {
                _deployToFtp(c, platform).then(resolve).catch(reject);
            })
            .catch(reject);
    }
});

export { deployToFtp };
