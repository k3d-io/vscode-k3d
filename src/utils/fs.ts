import * as sysfs from 'fs';
import { promisify } from 'util';

export const fs = {
    copyFile: promisify(sysfs.copyFile),
    exists: promisify(sysfs.exists),
    mkdir: promisify(sysfs.mkdir),
    readFile: promisify(sysfs.readFile),
    writeFile: promisify(sysfs.writeFile),
};
