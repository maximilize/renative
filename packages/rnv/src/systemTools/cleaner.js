import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { removeDirs } from './fileutils';
import { logTask, askQuestion, finishQuestion } from '../common';

const cleanProjectModules = c => new Promise((resolve, reject) => {
    logTask('cleanProjectModules');
    const pathsToRemove = [
        c.paths.projectNodeModulesFolder,
        path.join(c.paths.projectRootFolder, 'package-lock.json')
    ];
    let msg = chalk.red('./node_modules\n./package-lock.json\n');
    const packagesFolder = path.join(c.paths.projectRootFolder, 'packages');
    if (fs.existsSync(packagesFolder)) {
        fs.readdirSync(packagesFolder).forEach((dir) => {
            if (dir === '.DS_Store') {
                pathsToRemove.push(path.join(packagesFolder, dir));
                msg += chalk.red(`./packages/${dir}\n`);
            } else {
                pathsToRemove.push(path.join(packagesFolder, dir, 'node_modules'));
                pathsToRemove.push(path.join(packagesFolder, dir, 'package-lock.json'));
                msg += chalk.red(`./packages/${dir}/node_modules\n./packages/${dir}/package-lock.json\n`);
            }
        });
    }


    askQuestion(`Following files/folders will be removed:\n\n${msg}\npress (ENTER) to confirm`)
        .then(() => {
            finishQuestion();
            removeDirs(pathsToRemove).then(() => resolve())
                .catch(e => reject(e));
        })
        .catch(e => reject(e));
});

export { cleanProjectModules };
