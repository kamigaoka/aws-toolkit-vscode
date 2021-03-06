/*!
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as assert from 'assert'
import * as moment from 'moment'
import * as vscode from 'vscode'
import { CloudWatchLogs } from 'aws-sdk'
import { CloudWatchLogStreamData, LogStreamRegistry } from '../../../cloudWatchLogs/registry/logStreamRegistry'
import { CLOUDWATCH_LOGS_SCHEME } from '../../../shared/constants'

describe('LogStreamRegistry', async () => {
    let registry: LogStreamRegistry
    let map: Map<string, CloudWatchLogStreamData>
    const stream: CloudWatchLogStreamData = {
        data: [
            {
                timestamp: 1,
                message: 'is the loneliest number\n',
            },
            {
                timestamp: 2,
                message: 'can be as sad as one\n',
            },
            {
                timestamp: 3,
                message: '...dog night covered this song\n',
            },
            {
                message: 'does anybody really know what time it is? does anybody really care?\n',
            },
        ],
    }

    const simplerStream: CloudWatchLogStreamData = {
        data: [
            {
                message: 'short and sweet\n',
            },
        ],
    }

    const newText = 'a little longer now\n'
    const getLogEventsFromUriComponentsFn = async (): Promise<CloudWatchLogs.GetLogEventsResponse> => {
        return {
            events: [
                {
                    message: newText,
                },
            ],
        }
    }

    const registeredUri = vscode.Uri.parse(`${CLOUDWATCH_LOGS_SCHEME}:This:Is:Registered`)
    const shorterRegisteredUri = vscode.Uri.parse(`${CLOUDWATCH_LOGS_SCHEME}:Less:Is:More`)
    const missingRegisteredUri = vscode.Uri.parse(`${CLOUDWATCH_LOGS_SCHEME}:Not:Here:Dude`)

    beforeEach(() => {
        map = new Map<string, CloudWatchLogStreamData>()
        map.set(registeredUri.path, stream)
        map.set(shorterRegisteredUri.path, simplerStream)
        registry = new LogStreamRegistry(map)
    })

    describe('hasLog', () => {
        it('correctly returns whether or not the log is registered', () => {
            assert.strictEqual(registry.hasLog(registeredUri), true)
            assert.strictEqual(registry.hasLog(missingRegisteredUri), false)
        })
    })

    describe('registerLog', async () => {
        it("registers logs and doesn't overwrite existing logs", async () => {
            await registry.registerLog(missingRegisteredUri, getLogEventsFromUriComponentsFn)
            const blankPostRegister = registry.getLogContent(missingRegisteredUri)
            assert.strictEqual(blankPostRegister, newText)

            await registry.registerLog(shorterRegisteredUri, getLogEventsFromUriComponentsFn)
            const preregisteredLog = registry.getLogContent(shorterRegisteredUri)
            assert.strictEqual(preregisteredLog, `${simplerStream.data[0].message}`)
        })
    })

    describe('getLogContent', () => {
        it('gets unformatted log content', () => {
            const text = registry.getLogContent(registeredUri)

            assert.strictEqual(
                text,
                `${stream.data[0].message}${stream.data[1].message}${stream.data[2].message}${stream.data[3].message}`
            )
        })

        it('gets log content formatted to show timestamps', () => {
            const text = registry.getLogContent(registeredUri, { timestamps: true })

            assert.strictEqual(
                text,
                `${moment(1).format()}${'\t'}${stream.data[0].message}${moment(2).format()}${'\t'}${
                    stream.data[1].message
                }${moment(3).format()}${'\t'}${stream.data[2].message}                             ${'\t'}${
                    stream.data[3].message
                }`
            )
        })
    })

    describe('updateLog', async () => {
        it("adds content to existing streams at both head and tail ends and doesn't do anything if the log isn't registered", async () => {
            await registry.updateLog(shorterRegisteredUri, 'tail', getLogEventsFromUriComponentsFn)
            const initialWithTail = registry.getLogContent(shorterRegisteredUri)
            assert.strictEqual(initialWithTail, `${simplerStream.data[0].message}${newText}`)
            await registry.updateLog(shorterRegisteredUri, 'head', getLogEventsFromUriComponentsFn)
            const initialWithHeadAndTail = registry.getLogContent(shorterRegisteredUri)
            assert.strictEqual(initialWithHeadAndTail, `${newText}${simplerStream.data[0].message}${newText}`)

            await registry.updateLog(missingRegisteredUri, 'tail', getLogEventsFromUriComponentsFn)
            const unregisteredGet = registry.getLogContent(missingRegisteredUri)
            assert.strictEqual(unregisteredGet, undefined)
        })
    })

    describe('getRegisteredLogs', () => {
        it('contains string representations of registered logs only', () => {
            const registeredLogs = registry.getRegisteredLogs()
            assert.strictEqual(registeredLogs.includes(registeredUri.path), true)
            assert.strictEqual(registeredLogs.includes(shorterRegisteredUri.path), true)
            assert.strictEqual(registeredLogs.includes(missingRegisteredUri.path), false)
        })
    })

    describe('deregisterLog', () => {
        it('deletes a log', () => {
            assert.strictEqual(registry.hasLog(registeredUri), true)
            registry.deregisterLog(registeredUri)
            assert.strictEqual(registry.hasLog(registeredUri), false)
        })

        it('does not error if the log does not exist in the registry', () => {
            assert.strictEqual(registry.hasLog(missingRegisteredUri), false)
            registry.deregisterLog(missingRegisteredUri)
            assert.strictEqual(registry.hasLog(missingRegisteredUri), false)
        })
    })
})
