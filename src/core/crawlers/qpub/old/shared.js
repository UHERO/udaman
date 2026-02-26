/**
 * Shared configuration and utilities for QPub scraper
 * Used by both scrape.js and parse.js
 */

import { existsSync, readdirSync } from 'fs';
import path from 'path';

/**
 * Auto-detect NAS path (works for Mac, Windows, and Linux)
 * @returns {string} Path to the NAS qpub_scrape directory
 */
export function findNASPath() {
  const platform = process.platform;

  if (platform === 'darwin') {
    // macOS - check /Volumes/
    // First try the default path
    const defaultPath = '/Volumes/UHEROroot/work/research/housing/qpub_scrape';
    if (existsSync(defaultPath)) return defaultPath;

    // Search all mounted volumes
    try {
      const volumes = readdirSync('/Volumes');
      for (const volume of volumes) {
        const testPath = `/Volumes/${volume}/work/research/housing/qpub_scrape`;
        if (existsSync(testPath)) return testPath;
      }
    } catch (e) {
      // If can't read /Volumes, just return default
    }

    return defaultPath; // Return default even if not found
  } else if (platform === 'win32') {
    // Windows - check common network drive letters and UNC paths
    const driveLetters = ['Z', 'Y', 'X', 'W', 'V', 'U', 'T', 'S', 'R', 'Q', 'P', 'O', 'N', 'M'];

    for (const letter of driveLetters) {
      const testPath = `${letter}:\\work\\research\\housing\\qpub_scrape`;
      if (existsSync(testPath)) return testPath;
    }

    // Try UNC path
    const uncPath = '\\\\UHEROroot\\work\\research\\housing\\qpub_scrape';
    if (existsSync(uncPath)) return uncPath;

    // Return most common mapping as default
    return 'Z:\\work\\research\\housing\\qpub_scrape';
  }

  // Linux or other - use a generic path
  return '/mnt/UHEROroot/work/research/housing/qpub_scrape';
}

/**
 * Get island code from TMK
 * @param {string} tmk - TMK in format I-ZZ-SSS-PPP-CCCC
 * @returns {string} Island code (1, 2, 3, or 4)
 */
export function getIslandCode(tmk) {
  if (!tmk) return null;
  const parts = tmk.split('-');
  return parts[0];
}

/**
 * Get zone from TMK
 * @param {string} tmk - TMK in format I-ZZ-SSS-PPP-CCCC
 * @returns {string} Zone code
 */
export function getZone(tmk) {
  if (!tmk) return null;
  const parts = tmk.split('-');
  return parts[1];
}

/**
 * Get section from TMK
 * @param {string} tmk - TMK in format I-ZZ-SSS-PPP-CCCC
 * @returns {string} Section code
 */
export function getSection(tmk) {
  if (!tmk) return null;
  const parts = tmk.split('-');
  return parts[2];
}

/**
 * Get island name from code
 * @param {string} code - Island code (1, 2, 3, or 4)
 * @returns {string} Island name
 */
export function getIslandName(code) {
  const islandNames = {
    '1': 'Oahu',
    '2': 'Maui',
    '3': 'Hawaii',
    '4': 'Kauai'
  };
  return islandNames[code] || 'Unknown';
}

/**
 * Shared configuration for scraper and parser
 */
export const CONFIG = {
  // NAS paths
  NAS_PATH: findNASPath(),
  HTML_DIR: 'html_pages',
  JSON_DIR: 'json_files',
  RESULTS_DIR: 'results',

  // MySQL connection (can be overridden via environment variables)
  MYSQL_HOST: process.env.MYSQL_HOST || '128.171.200.230',
  MYSQL_USER: process.env.MYSQL_USER || 'uhero',
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || '9vnAZTVY4UagwCpRJtCa*kY',
  MYSQL_DATABASE: 'qpub_scraper',

  // Scraper-specific settings
  DELAY_MIN: 4000,
  DELAY_MAX: 20000,
  BACKUP_START_HOUR: 19, // 7 PM
  BACKUP_END_HOUR: 20,    // 8 PM
  NIGHTTIME_START_HOUR: 23, // 11 PM
  NIGHTTIME_END_HOUR: 5,    // 5 AM

  // Island codes
  ISLANDS: {
    '1': 'Oahu',
    '2': 'Maui',
    '3': 'Hawaii',
    '4': 'Kauai'
  },

  BASE_URLS: {
    '1': (tmk) => `https://qpublic.schneidercorp.com/Application.aspx?AppID=1045&LayerID=23342&PageTypeID=4&PageID=9746&KeyValue=${tmk}`,
    '2': (tmk) => `https://qpublic.schneidercorp.com/Application.aspx?AppID=1029&LayerID=21689&PageTypeID=4&PageID=9251&Q=665264273&KeyValue=${tmk}`,
    '3': (tmk) => `https://qpublic.schneidercorp.com/Application.aspx?AppID=1048&LayerID=23618&PageTypeID=4&PageID=9878&Q=252788940&KeyValue=${tmk}`,
    '4': (tmk) => `https://qpublic.schneidercorp.com/Application.aspx?AppID=986&LayerID=20101&PageTypeID=4&PageID=8744&Q=1302490479&KeyValue=${tmk}`,
  }
};

/**
 * Get full path to HTML directory for an island (optionally nested by zone/section)
 * @param {string} islandCode - Island code (1, 2, 3, or 4)
 * @param {string} tmk - Optional TMK for nested directory structure
 * @returns {string} Full path to HTML directory
 */
export function getHtmlPath(islandCode, tmk = null) {
  const basePath = path.join(CONFIG.NAS_PATH, CONFIG.HTML_DIR, islandCode);

  if (!tmk) {
    return basePath;
  }

  const zone = getZone(tmk);
  const section = getSection(tmk);

  if (!zone || !section) {
    return basePath;
  }

  return path.join(basePath, zone, section);
}

/**
 * Get full path to JSON output directory for an island (optionally nested by zone/section)
 * @param {string} islandCode - Island code (1, 2, 3, or 4)
 * @param {string} tmk - Optional TMK for nested directory structure
 * @returns {string} Full path to JSON directory
 */
export function getJsonPath(islandCode, tmk = null) {
  const basePath = path.join(CONFIG.NAS_PATH, CONFIG.JSON_DIR, islandCode);

  if (!tmk) {
    return basePath;
  }

  const zone = getZone(tmk);
  const section = getSection(tmk);

  if (!zone || !section) {
    return basePath;
  }

  return path.join(basePath, zone, section);
}

/**
 * Get full path to results directory for an island
 * @param {string} islandCode - Island code (1, 2, 3, or 4)
 * @returns {string} Full path to island's results directory
 */
export function getResultsPath(islandCode) {
  return path.join(CONFIG.NAS_PATH, CONFIG.RESULTS_DIR, islandCode);
}

// TMK normalization: ensure island code + CPR
export function normalizeTMK(tmk, islandCode) {
  // Remove .html if present
  tmk = tmk.replace('.html', '');

  // Split by dash or slash
  const parts = tmk.split(/[-\/]/);

  // If first part isn't the island code, prepend it
  if (parts[0] !== islandCode) {
    parts.unshift(islandCode);
  }

  // Ensure we have at least 6 parts (island-zone-section-plat-parcel-cpr)
  while (parts.length < 6) {
    parts.push('0000');
  }

  // Pad CPR to 4 digits if it's the last part
  if (parts.length === 6 && parts[5].length < 4) {
    parts[5] = parts[5].padStart(4, '0');
  }

  return parts.join('-');
}

export default CONFIG;
