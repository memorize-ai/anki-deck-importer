import { readFileSync as readFile } from 'fs'
import * as _ from 'lodash'
import * as mime from 'mime'
import * as uuid from 'uuid/v4'
import system = require('system-commands')
import admin, { firestore, storage } from './firebase-admin'

import { Database } from 'sqlite3'
import sqlite3 from './sqlite3'

import { matchAll } from './helpers'
import { DECKS_DOWNLOAD_PATH, ACCOUNT_ID, IMAGE_SRC_REGEX, SOUND_URL_REGEX, ASSET_CHUNK_SIZE, DEFAULT_STORAGE_BUCKET } from './constants'

type AssetMap = Record<string, string>

let assetPathCache: Record<string, string> = {}
let assets: {
	path: string
	destination: string
	contentType: string
	token: string
}[] = []

export default async (deckId: string, topicIds: string[]) => {
	assetPathCache = {}
	assets = []
	
	const path = `${DECKS_DOWNLOAD_PATH}/${deckId}`
	
	process.stdout.write('Unzipping deck...')
	
	await unzipDeck(path)
	
	console.log(' DONE')
	
	try {
		const db = new sqlite3.Database(`${path}/collection.anki2`)
		
		await new Promise(resolve =>
			db.serialize(async () => {
				process.stdout.write('Importing deck data...')
				
				await importDeck(db, deckId, topicIds)
				
				console.log(' DONE')
				
				await importCards(db, deckId, path, assetMapForPath(path))
				
				db.close(() => resolve())
			})
		)
		
		console.log(`Uploading ${assets.length} assets...`)
		
		await uploadAssets()
		
		console.log(`Uploaded ${assets.length} assets`)
		
		process.stdout.write('Deleting deck path...')
		
		await deleteDeck(path)
		
		console.log(' DONE')
	} catch (error) {
		console.error(error)
	}
	
	return deckId
}

const importDeck = (db: Database, deckId: string, topicIds: string[]) =>
	new Promise((resolve, reject) =>
		db.each('SELECT decks FROM col LIMIT 1', async (error, row) => {
			if (error)
				return reject(error.message)
			
			const deck: any = Object
				.entries(JSON.parse(row.decks || '{}'))
				.filter(([key]) => key !== '1')[0][1]
			
			await firestore
				.doc(`decks/${deckId}`)
				.create({
					topics: topicIds,
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
					updated: admin.firestore.FieldValue.serverTimestamp(),
					source: 'anki'
				})
				.catch(reject)
			
			resolve()
		})
	)

const importCards = (db: Database, deckId: string, path: string, assetMap: AssetMap) =>
	new Promise((resolve, reject) =>
		db.each('SELECT models FROM col', (modelsError, modelsRow) => {
			if (modelsError)
				return reject(modelsError.message)
			
			db.all('SELECT * FROM cards', (cardsError, cardRows) => {
				if (cardsError)
					return reject(cardsError.message)
				
				db.all('SELECT * FROM notes', async (notesError, noteRows) => {
					if (notesError)
						return reject(notesError.message)
					
					const models = JSON.parse(modelsRow.models || '{}')
					
					try {
						const cards: FirebaseFirestore.DocumentData[] = []
						
						for (const note of noteRows)
							try {
								const noteId = note.id
								const card = cardRows.find(cardRow => cardRow.nid === noteId)
								
								if (!card)
									throw new Error('Cannot find card')
								
								const model = models[note.mid]
								const { qfmt, afmt } = model.tmpls[card.ord]
								
								cards.push({
									section: '',
									...getCardSides(deckId, {
										path,
										assetMap,
										fieldNames: model.flds
											.sort(({ ord: a }: any, { ord: b }: any) => a - b)
											.map(({ name }: any) => name),
										fieldValues: note.flds.split('\u001f'),
										frontTemplate: qfmt,
										backTemplate: afmt
									}),
									viewCount: 0,
									reviewCount: 0,
									skipCount: 0,
									tags: note.tags
										.split(/\s+/)
										.map((tag: string) => tag.trim().toLowerCase())
										.filter(Boolean)
								})
								
								console.log(`Card ${cards.length}/${noteRows.length} added to queue`)
							} catch (error) {
								console.error(error)
							}
						
						console.log(`Uploading ${cards.length} cards...`)
					
						const chunked = _.chunk(cards, 500)
						let i = 0
						
						for (const chunk of chunked) {
							const message = `Uploading card chunk ${++i}/${chunked.length}... `
							
							process.stdout.write(`${message}0/${chunk.length}\r`)
							
							const batch = firestore.batch()
							
							for (const card of chunk)
								batch.create(
									firestore.collection(`decks/${deckId}/cards`).doc(),
									card
								)
							
							await batch.commit()
							
							console.log(`${message}${chunk.length}/${chunk.length}`)
						}
						
						console.log(`Uploaded ${cards.length} cards`)
						
						resolve()
					} catch (error) {
						reject(error)
					}
				})
			})
		})
	)

const uploadAssets = async () => {
	const chunked = _.chunk(assets, ASSET_CHUNK_SIZE)
	let i = 0
	
	for (const chunk of chunked) {
		const message = `Uploading asset chunk ${++i}/${chunked.length}... `
		
		process.stdout.write(`${message}0/${chunk.length}\r`)
		
		let j = 0
		
		await Promise.all(chunk.map(({ path, destination, contentType, token }) =>
			storage
				.upload(path, {
					destination,
					public: true,
					metadata: {
						contentType,
						owner: ACCOUNT_ID,
						metadata: {
							firebaseStorageDownloadTokens: token
						}
					}
				})
				.then(() => process.stdout.write(`${message}${++j}/${chunk.length}\r`))
				.catch(error => {
					console.error(`Error uploading asset: ${error}`)
					j++
				})
		))
		
		console.log()
	}
}

const getCardSides = (
	deckId: string,
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
	
	front = replaceAssetsInTemplate(deckId, path, assetMap, front)
	
	return {
		front,
		back: replaceAssetsInTemplate(
			deckId,
			path,
			assetMap,
			replaceFieldInTemplate('FrontSide', front, back)
		)
	}
}

const replaceFieldInTemplate = (name: string, value: string, template: string) =>
	template.replace(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'g'), value)

const replaceAssetsInTemplate = (deckId: string, path: string, assetMap: AssetMap, template: string) => {
	let temp = template
	
	const imageMatches = matchAll(temp, IMAGE_SRC_REGEX)
	
	for (const { match, captures } of imageMatches)
		try {
			const name = captures[0].trim()
			
			console.log(`Found asset in card template: ${name}`)
			
			const url = getAssetUrl(deckId, `${path}/${assetMap[name]}`, name)
			
			console.log(`Found asset url: ${url}`)
			
			temp = temp.replace(
				match,
				`<img src="${url}" alt="${formatAssetName(name)}">`
			)
		} catch (error) {
			console.error(error)
		}
	
	const soundMatches = matchAll(temp, SOUND_URL_REGEX)
	
	for (const { match, captures } of soundMatches)
		try {
			const name = captures[0].trim()
			
			console.log(`Found asset in card template: ${name}`)
			
			const url = getAssetUrl(deckId, `${path}/${assetMap[name]}`, name)
			
			console.log(`Found asset url: ${url}`)
			
			temp = temp.replace(
				match,
				`<audio controls src="${url}">Audio unavailable: ${formatAssetName(name)}</audio>`
			)
		} catch (error) {
			console.error(error)
		}
	
	return temp
}

const getAssetUrl = (deckId: string, path: string, name: string) =>
	assetPathCache[path] ?? cacheAssetPath(path, addAsset(deckId, path, name))

const addAsset = (deckId: string, path: string, name: string) => {
	const token = uuid()
	const { id } = firestore.collection('deck-assets').doc()
	const contentType = mime.getType(name)
	
	if (contentType === null)
		throw new Error('Invalid content type')
	
	assets.push({
		path,
		destination: `deck-assets/${deckId}/${id}`,
		contentType,
		token
	})
	
	return `https://firebasestorage.googleapis.com/v0/b/${DEFAULT_STORAGE_BUCKET}/o/deck-assets%2F${deckId}%2F${id}?alt=media&token=${token}`
}

const cacheAssetPath = (path: string, url: string) =>
	assetPathCache[path] = url

const formatAssetName = (name: string) =>
	_.capitalize(name.split('.').slice(0, -1).join('.').replace(/[\-_\s]+/g, ' '))

const unzipDeck = (path: string) => {
	const zippedFile = `${path}/main.apkg`
	return system(
		`if [[ -e '${zippedFile}' ]]; then unzip '${zippedFile}' -d '${path}' && rm -rf '${zippedFile}'; fi`,
		32 * 1024 * 1024
	)
}

const deleteDeck = (path: string) =>
	system(`rm -rf '${path}'`)

const assetMapForPath = (path: string) =>
	_.invert(JSON.parse(readFile(`${path}/media`).toString() || '{}'))
