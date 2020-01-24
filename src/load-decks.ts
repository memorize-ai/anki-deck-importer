import { writeFileSync as writeFile } from 'fs'
import fetch from 'node-fetch'

import { TOPICS_PATH, DECKS_PATH } from './constants'

export default async (topics: Record<string, string[]> = require(TOPICS_PATH)) => {
	for (const [topicId, topicNames] of Object.entries(topics))
		for (const topicName of topicNames) {
			const match = (await (await fetch(`https://ankiweb.net/shared/decks/${topicName}`)).text())
				.match(/shared\.files\s=\s(\[.*\]?);/)
			
			if (!match) {
				console.error(`Unable to load decks for topic ${topicId}: ${topicName}`)
				continue
			}
			
			const deckIds: string[] = JSON.parse(match[1]).map((array: [number]) => array[0].toString())
			
			for (const deckId of deckIds)
				addDeck(deckId, topicId)
		}
	
	return topics
}

const addDeck = (deckId: string, topicId: string) => {
	const decks: Record<string, {
		downloaded: boolean
		imported: boolean
		topics: string[]
	}> = require(DECKS_PATH)
	
	const existingDeck = decks[deckId]
	
	existingDeck
		? existingDeck.topics = [...new Set([...existingDeck.topics, topicId])]
		: decks[deckId] = {
			downloaded: false,
			imported: false,
			topics: [topicId]
		}
	
	writeFile(DECKS_PATH, JSON.stringify(decks))
}

if (require.main === module)
	exports.default().then(console.log).catch(console.error)
