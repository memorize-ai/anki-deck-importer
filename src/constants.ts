import { join } from 'path'

export const ACCOUNT_ID = 'tte9RbI9akMzWfs1bWxJRz4nTou1'

export const DECKS_PATH = join(__dirname, '../products/decks.json')
export const TOPICS_PATH = join(__dirname, '../products/topics.json')

export const DECKS_DOWNLOAD_PATH = join(__dirname, '../products/decks')

export const FIREBASE_ADMIN_KEY_PATH = join(__dirname, '../protected/firebase-admin.json')

export const IMAGE_SRC_REGEX = /<img\s+[^>]*src\s*=\s*["'](.+?)["'][^>]*\/?>/

export const SOUND_URL_REGEX = /\[\s*[Ss][Oo][Uu][Nn][Dd]\s*\:\s*(.+?)\s*\]/

export const DOWNLOAD_DECK_ERROR_MESSAGE = 'Download limit from your connection reached; try again tomorrow.'
