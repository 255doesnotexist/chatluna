import * as fetchType from 'undici/types/fetch'
import { ChatLunaError, ChatLunaErrorCode } from './error'

const BOM = 0xfeff
const LF = 0x000a
const CR = 0x000d
const SPACE = 0x0020
const COLON = 0x003a

/**
 * Event type push by {@link createParser}
 */
export type SSEEvent = {
    /**
     * event field (name)
     */
    event?: string
    /**
     * data field
     */
    data?: string
    /**
     * comments in event
     */
    comments?: string[]
} & Record<string, string> // record for any not standard event fields

export function createParser() {
    let state = 'stream'

    let temp: SSEEvent = {}
    let comment = ''
    let fieldName = ''
    let fieldValue = ''

    // eslint-disable-next-line generator-star-spacing
    function* parse(data: string) {
        const cursor = data[Symbol.iterator]()
        let value: IteratorResult<string> = { done: false, value: '' }
        const looks: IteratorResult<string>[] = []

        function lookNext(
            ignoreIfFn: (v: IteratorResult<string>) => boolean
        ): void {
            next()

            if (value.value === undefined) return

            if (!ignoreIfFn(value)) {
                looks.push(value)
            }
        }

        function next(): boolean {
            if (looks.length > 0) {
                value = looks.shift() as IteratorResult<string>
                return value.done ?? false
            }

            value = cursor.next()
            return value.done ?? false
        }

        while (!next()) {
            const char = value.value
            const charCode = char.codePointAt(0)

            function isLF(): boolean {
                if (charCode === LF) return true
                if (charCode === CR) {
                    lookNext((c) => c.value.codePointAt(0) === LF)
                    return true
                }

                return false
            }

            switch (state) {
                case 'stream':
                    state = 'event'
                    if (charCode === BOM) break
                // tslint:disable-next-line: no-fallthrough --> intentional fallthrough
                case 'event':
                    if (isLF()) {
                        yield temp
                        temp = {}
                    } else if (charCode === COLON) {
                        state = 'comment'
                        comment = ''
                    } else {
                        state = 'field'
                        fieldName = char
                        fieldValue = ''
                    }
                    break
                case 'comment':
                    if (isLF()) {
                        if (temp.comments === undefined) {
                            temp.comments = []
                        }
                        temp.comments.push(comment)
                        comment = ''
                        state = 'event'
                    } else {
                        comment += char
                    }
                    break
                case 'field':
                    if (charCode === COLON) {
                        lookNext((c) => c.value.codePointAt(0) === SPACE)
                        state = 'field_value'
                    } else if (isLF()) {
                        if (temp[fieldName] !== undefined)
                            temp[fieldName] += '\n'
                        else temp[fieldName] = ''
                        fieldName = ''
                        fieldValue = ''
                        state = 'event'
                    } else fieldName += char
                    break
                case 'field_value':
                    if (isLF()) {
                        if (temp[fieldName] !== undefined)
                            temp[fieldName] += '\n' + fieldValue
                        else temp[fieldName] = fieldValue
                        fieldName = ''
                        fieldValue = ''
                        state = 'event'
                    } else fieldValue += char
            }
        }
    }

    return (data: string) => parse(data)
}

export async function sse(
    response: fetchType.Response | ReadableStreamDefaultReader<string>,
    onEvent: (
        rawData: string
    ) => Promise<string | boolean | void> = async () => {},
    cacheCount: number = 0
) {
    if (!(response instanceof ReadableStreamDefaultReader || response.ok)) {
        const error = await response.json().catch(() => ({}))

        throw new ChatLunaError(
            ChatLunaErrorCode.NETWORK_ERROR,
            new Error(
                `${response.status} ${response.statusText} ${JSON.stringify(
                    error
                )}`
            )
        )
    }

    const reader =
        response instanceof ReadableStreamDefaultReader
            ? response
            : response.body.getReader()

    const decoder = new TextDecoder('utf-8')

    let bufferString = ''

    let tempCount = 0

    try {
        while (true) {
            const { value, done } = await reader.read()

            if (done) {
                if (bufferString.length > 0) {
                    await onEvent(bufferString)
                }
                break
            }

            const decodeValue = decoder.decode(value, { stream: true })

            bufferString += decodeValue
            tempCount++

            if (tempCount > cacheCount) {
                await onEvent(bufferString)

                bufferString = ''
                tempCount = 0
            }
        }
    } finally {
        reader.releaseLock()
    }
}

// eslint-disable-next-line generator-star-spacing
export async function* sseIterable(
    response: fetchType.Response | ReadableStreamDefaultReader<string>
) {
    if (!(response instanceof ReadableStreamDefaultReader) && !response.ok) {
        const error = await response.json().catch(() => ({}))

        throw new ChatLunaError(
            ChatLunaErrorCode.NETWORK_ERROR,
            new Error(
                `${response.status} ${response.statusText} ${JSON.stringify(
                    error
                )}`
            )
        )
    }

    const reader =
        response instanceof ReadableStreamDefaultReader
            ? response
            : response.body.getReader()

    const decoder = new TextDecoder('utf-8')

    const parse = createParser()

    try {
        while (true) {
            const { value, done } = await reader.read()

            if (done) {
                return '[DONE]'
            }

            const decodeValue = decoder.decode(value, { stream: true })

            if (decodeValue.trim().length === 0) {
                continue
            }

            for (const event of parse(decodeValue)) {
                yield event.data
            }
        }
    } finally {
        reader.releaseLock()
    }
}
