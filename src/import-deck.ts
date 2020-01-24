import { readFileSync as readFile } from 'fs'
import * as _ from 'lodash'
import * as mime from 'mime'
import * as uuid from 'uuid/v4'
import system = require('system-commands')
import admin, { firestore, storage } from './firebase-admin'

import { Database } from 'sqlite3'
import sqlite3 from './sqlite3'

import { matchAll } from './helpers'
import { TOPICS_PATH, DECKS_DOWNLOAD_PATH, ACCOUNT_ID, IMAGE_SRC_REGEX, SOUND_URL_REGEX } from './constants'

type AssetMap = Record<string, string>

const topics: Record<string, string[]> = require(TOPICS_PATH)
const assetPathCache: Record<string, string> = {}

export default async (deckId: string, topicIds: string[]) => {
	const path = `${DECKS_DOWNLOAD_PATH}/${deckId}`
	
	console.log('Unzipping deck...')
	
	await unzipDeck(path)
	
	console.log('Unzipped deck')
	
	const db = new sqlite3.Database(`${path}/collection.anki2`)
	
	await new Promise(resolve =>
		db.serialize(async () => {
			console.log('Importing deck data...')
			
			await importDeck(db, deckId, topicIds)
			
			console.log('Imported deck data')
			console.log('Importing cards...')
			
			await importCards(db, deckId, path, assetMapForPath(path))
			
			console.log('Imported cards')
			
			resolve()
		})
	)
	
	console.log('Deleting deck path...')
	
	await deleteDeck(path)
	
	console.log('Deleted deck path')
	
	return deckId
}

const importDeck = (db: Database, deckId: string, topicIds: string[]) =>
	new Promise((resolve, reject) =>
		db.each('SELECT decks FROM col LIMIT 1', async (error, row) => {
			if (error) {
				reject(error.message)
				return
			}
			
			const deck: any = Object
				.entries(JSON.parse(row.decks || '{}'))
				.filter(([key]) => key !== '1')[0][1]
			
			await firestore
				.doc(`decks/${deckId}`)
				.create({
					topics: topicIds.reduce((acc, topicId) => [
						...acc,
						...topics[topicId] ?? []
					], [] as string[]),
					hasImage: false,
					name: deck.name.replace(/\s+/g, ' '),
					subtitle: '',
					description: '',
					viewCount: 0,
					uniqueViewCount: 0,
					ratingCount: 0,
					'1StarRatingCount': 0,
					'2StarRatingCount': 0,
					'3StarRatingCount': 0,
					'4StarRatingCount': 0,
					'5StarRatingCount': 0,
					averageRating: 0,
					downloadCount: 0,
					cardCount: 0,
					unsectionedCardCount: 0,
					currentUserCount: 0,
					allTimeUserCount: 0,
					favoriteCount: 0,
					creator: ACCOUNT_ID,
					created: admin.firestore.FieldValue.serverTimestamp(),
					updated: admin.firestore.FieldValue.serverTimestamp()
				})
				.catch(reject)
			
			resolve()
		})
	)

const importCards = (db: Database, deckId: string, path: string, assetMap: AssetMap) =>
	new Promise((resolve, reject) =>
		db.each('SELECT models FROM col', (modelsError, modelsRow) => {
			if (modelsError) {
				reject(modelsError.message)
				return
			}
			
			db.all('SELECT * FROM cards', (cardsError, cardRows) => {
				if (cardsError) {
					reject(cardsError.message)
					return
				}
				
				db.all('SELECT * FROM notes', async (notesError, noteRows) => {
					if (notesError) {
						reject(notesError.message)
						return
					}
					
					const models = JSON.parse(modelsRow.models || '{}')
					
					try {
						const cards: FirebaseFirestore.DocumentData[] = []
						
						for (const note of noteRows) {
							const noteId = note.id
							const card = cardRows.find(cardRow => cardRow.nid === noteId)
							
							if (!card)
								continue
							
							const model = models[note.mid]
							const { qfmt, afmt } = model.tmpls[card.ord]
							
							const sides = await getCardSides({
								path,
								assetMap,
								fieldNames: model.flds
									.sort(({ ord: a }: any, { ord: b }: any) => a - b)
									.map(({ name }: any) => name),
								fieldValues: note.flds.split('\u001f'),
								frontTemplate: qfmt,
								backTemplate: afmt
							})
							
							cards.push({
								section: '',
								...sides,
								viewCount: 0,
								reviewCount: 0,
								skipCount: 0,
								tags: note.tags
									.split(/\s+/)
									.map((tag: string) => tag.trim().toLowerCase())
									.filter(Boolean)
							})
							
							console.log('Card added to queue')
						}
						
						const batch = firestore.batch()
						
						for (const card of cards)
							batch.set(
								firestore.collection(`decks/${deckId}/cards`).doc(),
								card
							)
						
						console.log('Committing write batch for cards...')
						
						await batch.commit()
						
						console.log('Committed write batch for cards')
						
						resolve()
					} catch (error) {
						reject(error)
					}
				})
			})
		})
	)

const getCardSides = async (
	{
		path,
		assetMap,
		fieldNames,
		fieldValues,
		frontTemplate,
		backTemplate
	}: {
		path: string
		assetMap: AssetMap
		fieldNames: string[]
		fieldValues: string[]
		frontTemplate: string
		backTemplate: string
	}
) => {
	let front = frontTemplate
	let back = backTemplate
	
	fieldValues.forEach((value, index) => {
		const field = fieldNames[index]
		
		front = replaceFieldInTemplate(field, value, front)
		back = replaceFieldInTemplate(field, value, back)
	})
	
	front = await replaceAssetsInTemplate(path, assetMap, front)
	
	return {
		front,
		back: await replaceAssetsInTemplate(
			path,
			assetMap,
			replaceFieldInTemplate('FrontSide', front, back)
		)
	}
}

const replaceFieldInTemplate = (name: string, value: string, template: string) =>
	template.replace(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'g'), value)

const replaceAssetsInTemplate = async (path: string, assetMap: AssetMap, template: string) => {
	let temp = template
	
	for (const { match, captures } of matchAll(template, IMAGE_SRC_REGEX)) {
		const name = captures[0].trim()
		
		console.log(`Found asset in card template: ${name}`)
		console.log('Loading asset url...')
		
		const url = await getAssetUrl(`${path}/${assetMap[name]}`, name)
		
		console.log(`Found asset url: ${url}`)
		
		temp = temp.replace(
			match,
			`<img src="${url}" alt="${formatAssetName(name)}">`
		)
	}
	
	for (const { match, captures } of matchAll(template, SOUND_URL_REGEX)) {
		const name = captures[0].trim()
		
		console.log(`Found asset in card template: ${name}`)
		console.log('Loading asset url...')
		
		const url = await getAssetUrl(`${path}/${assetMap[name]}`, name)
		
		console.log(`Found asset url: ${url}`)
		
		temp = temp.replace(
			match,
			`<audio controls src="${url}">Audio unavailable: ${formatAssetName(name)}</audio>`
		)
	}
	
	return temp
}

const getAssetUrl = async (path: string, name: string) =>
	assetPathCache[path] ?? cacheAssetPath(path, await uploadAsset(path, name))

const uploadAsset = async (path: string, name: string) => {
	const token = uuid()
	const { id } = firestore.collection('decks').doc()
	const contentType = mime.getType(name)
	
	if (contentType === null)
		return Promise.reject('Invalid content type')
	
	console.log(`Uploading asset with contentType "${contentType}"`)
	
	await storage.upload(path, {
		destination: `deck-assets/${id}`,
		public: true,
		metadata: {
			contentType,
			owner: ACCOUNT_ID,
			metadata: {
				firebaseStorageDownloadTokens: token
			}
		}
	})
	
	console.log('Finished uploading asset')
	
	return `https://firebasestorage.googleapis.com/v0/b/memorize-ai-dev.appspot.com/o/deck-assets%2F${id}?alt=media&token=${token}`
}

const cacheAssetPath = (path: string, url: string) =>
	assetPathCache[path] = url

const formatAssetName = (name: string) =>
	_.capitalize(name.split('.')[0].replace(/[\-_\s]+/g, ' '))

const unzipDeck = (path: string) => {
	const zippedFile = `${path}/main.apkg`
	return system(`unzip '${zippedFile}' -d '${path}' && rm -rf '${zippedFile}'`, 32 * 1024 * 1024)
}

const deleteDeck = (path: string) =>
	system(`rm -rf '${path}'`)

const assetMapForPath = (path: string) =>
	_.invert(JSON.parse(readFile(`${path}/media`).toString() || '{}'))
