import { join } from 'path'

export const DEBUG = false

export const ACCOUNT_ID = DEBUG ? '5xh8ODFbtIfBh7LjA0zGRlpc3kf1' : 'LexVW5dWZHTQPe1DPPi68Zqt7aS2'

export const DECKS_PATH = join(__dirname, '../products/decks.json')
export const TOPICS_PATH = join(__dirname, '../products/topics.json')

export const DECKS_DOWNLOAD_PATH = join(__dirname, '../products/decks')

export const FIREBASE_ADMIN_KEY_PATH = join(__dirname, `../protected/firebase-admin${DEBUG ? '-dev' : ''}.json`)

export const IMAGE_SRC_REGEX = /<img\s+[^>]*src\s*=\s*["'](.+?)["'][^>]*\/?>/

export const SOUND_URL_REGEX = /\[\s*[Ss][Oo][Uu][Nn][Dd]\s*\:\s*(.+?)\s*\]/

export const ASSET_CHUNK_SIZE = 500

export const DEFAULT_STORAGE_BUCKET = `memorize-ai${DEBUG ? '-dev' : ''}.appspot.com`
