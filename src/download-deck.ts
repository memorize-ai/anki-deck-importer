import { mkdirSync as mkdir, createWriteStream } from 'fs'
import fetch from 'node-fetch'

import { DECKS_DOWNLOAD_PATH } from './constants'

export default async (deckId: string) => {
	const path = `${DECKS_DOWNLOAD_PATH}/${deckId}`
	
	mkdir(path)
	
	;(await getDeckData(deckId))
		.pipe(createWriteStream(`${path}/main.apkg`))
	
	return deckId
}

const getDeckData = async (deckId: string) => {
	const match = (await (await fetch(`https://ankiweb.net/shared/info/${deckId}`)).text())
		.match(/<input type="hidden" name="k" value="(.*?)">/)
	
	return match
		? (await fetch(`https://ankiweb.net/shared/downloadDeck/${deckId}?k=${match[1]}`)).body
		: Promise.reject('"k" not found')
}
