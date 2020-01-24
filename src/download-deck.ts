import { mkdirSync as mkdir, createWriteStream } from 'fs'
import fetch from 'node-fetch'

import { DECKS_DOWNLOAD_PATH, DOWNLOAD_DECK_ERROR_MESSAGE } from './constants'

export default async (deckId: string) => {
	const path = `${DECKS_DOWNLOAD_PATH}/${deckId}`
	
	const data = await getDeckData(deckId)
	
	mkdir(path)
	
	data.pipe(createWriteStream(`${path}/main.apkg`))
	
	return deckId
}

const getDeckData = async (deckId: string) => {
	const match = (await (await fetch(`https://ankiweb.net/shared/info/${deckId}`)).text())
		.match(/<input type="hidden" name="k" value="(.*?)">/)
	
	if (!match)
		return Promise.reject('"k" query parameter not found')
	
	const response = await fetch(`https://ankiweb.net/shared/downloadDeck/${deckId}?k=${match[1]}`)
	
	return (await response.text()) === DOWNLOAD_DECK_ERROR_MESSAGE
		? Promise.reject('The download limit has been reached')
		: response.body
}
