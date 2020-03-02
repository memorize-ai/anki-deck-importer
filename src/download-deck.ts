import { mkdirSync as mkdir } from 'fs'

import { DECKS_DOWNLOAD_PATH } from './constants'
import { request, downloadRequest } from './helpers'

export default async (deckId: string) => {
	const path = `${DECKS_DOWNLOAD_PATH}/${deckId}`
	
	mkdir(path)
	await downloadDeck(deckId, `${path}/main.apkg`)
	
	return deckId
}

const downloadDeck = async (deckId: string, path: string) => {
	const { body } = await request(`https://ankiweb.net/shared/info/${deckId}`)
	const k: string | undefined = (body?.match(/<input type="hidden" name="k" value="(.*?)">/) ?? [])[1]
	
	if (!k) {
		const error = new Error('"k" query parameter not found')
		;(error as any).code = 'missing-k-query-parameter'
		throw error
	}
	
	return downloadRequest(`https://ankiweb.net/shared/downloadDeck/${deckId}?k=${k}`, path)
}
