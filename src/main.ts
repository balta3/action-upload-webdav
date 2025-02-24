import * as glob from '@actions/glob'
import * as path from 'path'
import {filePaths, parseConfig, unmatchedPatterns} from './util'
import {info, notice, setFailed} from '@actions/core'
import {createClient} from 'webdav'
import {createReadStream} from 'fs'

async function run(): Promise<void> {
    const config = parseConfig()

    const patterns = await unmatchedPatterns(config.files)
    for (const pattern of patterns) {
        notice(`🤔 Pattern '${pattern}' does not match any files.`)
    }
    if (patterns.length > 0 && config.failOnUnmatchedFiles) {
        throw new Error(`⛔ There were unmatched files`)
    }

    const files = await filePaths(config.files)
    if (files.length === 0) {
        notice(`🤔 ${config.files} not include valid file.`)
    }

    const client = createClient(config.webdavAddress, {
        username: config.webdavUsername,
        password: config.webdavPassword
    })

    const filesBase = config.filesBase ? (await glob.create(config.filesBase).then(g => g.glob()))[0] : ''

    // first be sure there are have directory
    if ((await client.exists(config.webdavUploadPath)) === false) {
        await client.createDirectory(config.webdavUploadPath, {recursive: true})
    }
    for (const file of files) {
        const uploadPath = filesBase
            ? path.join(
                config.webdavUploadPath,
                path.relative(filesBase, file)
            )
            : path.join(
                config.webdavUploadPath,
                path.basename(file)
            )
        try {
            info(`📦 Uploading ${file} to ${uploadPath}`)
            const dirName = path.dirname(uploadPath)
            if ((await client.exists(dirName)) === false) {
                await client.createDirectory(dirName, {recursive: true})
            }
            createReadStream(file).pipe(client.createWriteStream(uploadPath))
            notice(`🎉 Uploaded ${uploadPath}`)
        } catch (error) {
            info(`error: ${error}`)
            notice(`⛔ Failed to upload file '${file}' to '${uploadPath}'`)
        }
    }
}

run().catch(err => setFailed(err.message))
