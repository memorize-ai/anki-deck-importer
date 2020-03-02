import { createWriteStream } from 'fs'
import { request as torRequest } from 'tor-request'

export const request = (url: string): Promise<{ body: any } & Record<string, any>> =>
	new Promise((resolve, reject) =>
		torRequest(url, (error: any, result: any) =>
			error
				? reject(error)
				: resolve(result)
		)
	)

export const downloadRequest = (url: string, path: string): Promise<void> =>
	new Promise(resolve =>
		torRequest(url)
			.pipe(createWriteStream(path))
			.once('close', resolve)
	)

export const matchAll = (string: string, regex: RegExp) =>
	(string.match(new RegExp(regex, `g${regex.ignoreCase ? 'i' : ''}${regex.multiline ? 'm' : ''}`)) ?? [])
		.map(match => ({
			match,
			captures: match.match(regex)?.slice(1)!
		}))
		.filter(({ captures }) => captures)
