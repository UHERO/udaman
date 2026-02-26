#!/usr/bin/env node

/**
 * Property Data HTML Parser
 *
 * Extracts property tax assessment data from QPub HTML files.
 * Handles both residential and non-residential properties across different counties.
 *
 * Features:
 * - Detects page status (success/blocked/captcha/failed)
 * - Extracts simple key-value pairs from two-column tables
 * - Extracts multi-row tables (assessments, owners, etc.)
 * - Organizes data by section headers
 * - Saves results as JSON files
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'node-html-parser';
import { CONFIG, getIslandCode, getJsonPath } from './shared.js';
import { SECTION_PARSERS } from './parse-sections.js';
import { normalizeNumericValues } from './parse-utils.js';

/**
 * Determines the status of the HTML page
 */
function detectPageStatus(html, root) {
    const htmlLower = html.toLowerCase();

    // Check for Cloudflare block page first
    if (htmlLower.includes('sorry, you have been blocked')) {
        return 'blocked';
    }

    // Check for reCAPTCHA/captcha page
    if (htmlLower.includes('recaptcha') && htmlLower.includes("we're sorry")) {
        return 'captcha';
    }

    // Check for incomplete page (no body or very short)
    if (!root.querySelector('body') || html.length < 5000) {
        return 'failed';
    }

    // Check for condo project by looking for specific tables that list multiple units
    // These tables indicate it's a condo project with multiple units
    const hasCondoTable = root.querySelector('table[id*="gvwCondos"]'); // Condo unit list
    const hasResultsTable = root.querySelector('table#ctlBodyPane_ctl00_ctl01_gvwParcelResults'); // Search results with units

    if (hasCondoTable || hasResultsTable) {
        return 'condo_project';
    }

    // Check for successful property page (has parcel number in table)
    const strongTags = root.querySelectorAll('strong');
    const hasParcelNumber = Array.from(strongTags).some(tag =>
        tag.textContent && tag.textContent.includes('Parcel Number')
    );

    if (hasParcelNumber) {
        return 'success';
    }

    return 'unknown';
}

/**
 * Extracts TMK from filename
 */
function extractTMKFromFilename(filename) {
    // Remove path and extension
    const basename = path.basename(filename, '.html');
    // Extract TMK pattern (e.g., 1-1-1-002-001-0000 or 1-94-066-004-0000)
    const match = basename.match(/^[\d-]+/);
    return match ? match[0] : null;
}

/**
 * Cleans and normalizes text content
 */
function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extracts data from a two-column table (key-value pairs)
 */
function extractTwoColumnTable(table) {
    const data = {};
    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td');

        if (th && td) {
            // Extract key from th (remove <strong> tags)
            let key = cleanText(th.textContent);
            // Remove ":" at the end if present
            key = key.replace(/:$/, '');

            // Extract value from td
            let value = cleanText(td.textContent);

            // Extract link if present
            const link = td.querySelector('a');
            const href = link ? link.getAttribute('href') : null;

            // Extract image if present
            const img = td.querySelector('img');
            const imgSrc = img ? img.getAttribute('src') : null;

            // Convert key to snake_case
            const snakeCaseKey = key
                .toLowerCase()
                .replace(/[^\w\s]/g, '')
                .replace(/\s+/g, '_');

            if (snakeCaseKey) {
                data[snakeCaseKey] = value;

                // Add link if present
                if (href) {
                    data[snakeCaseKey + '_url'] = href.startsWith('http') ? href : 'https://qpublic.schneidercorp.com' + href;
                }

                // Add image URL if present
                if (imgSrc) {
                    data[snakeCaseKey + '_image_url'] = imgSrc.startsWith('http') ? imgSrc : 'https://qpublic.schneidercorp.com' + imgSrc;
                }
            }
        }
    });

    return data;
}

/**
 * Check if a row is a detail/expansion row (contains nested tables)
 */
function isDetailRow(row) {
    // Detail rows have a single td with large colspan
    const cells = row.querySelectorAll('td');
    if (cells.length === 0) return false;

    // Check for colspan attribute
    for (const cell of cells) {
        const colspan = cell.getAttribute('colspan');
        if (colspan && (colspan === '100%' || parseInt(colspan) > 5)) {
            return true;
        }
    }

    return false;
}

/**
 * Extract nested tables from a detail row
 */
function extractNestedTablesFromDetailRow(detailRow) {
    const nestedData = {};

    // Find the div container
    const containerDiv = detailRow.querySelector('td > div');
    if (!containerDiv) return nestedData;

    // Look for nested tables with labels
    const labels = containerDiv.querySelectorAll('label');
    labels.forEach(label => {
        const labelText = cleanText(label.textContent);

        // Find the table that follows this label
        let nextElement = label.nextElementSibling;
        while (nextElement) {
            if (nextElement.tagName === 'DIV') {
                const nestedTable = nextElement.querySelector('table');
                if (nestedTable) {
                    // Extract this nested table
                    const tableData = extractNestedTable(nestedTable);

                    // Create a key from the label
                    const key = labelText
                        .toLowerCase()
                        .replace(/[^\w\s]/g, ' ')
                        .replace(/\s+/g, '_')
                        .replace(/_+/g, '_')
                        .replace(/^_|_$/g, '');

                    if (key && tableData.length > 0) {
                        nestedData[key] = tableData;
                    }
                    break;
                }
            }
            nextElement = nextElement.nextElementSibling;
        }
    });

    return nestedData;
}

/**
 * Extract a nested table (simple table without special features)
 */
function extractNestedTable(table) {
    const headers = [];
    const rows = [];

    // Find header row (first tr with th elements)
    const allRows = table.querySelectorAll('tr');
    let dataStartIndex = 0;

    for (let i = 0; i < allRows.length; i++) {
        const headerCells = allRows[i].querySelectorAll('th');
        if (headerCells.length > 0) {
            headerCells.forEach(cell => {
                let headerText = cleanText(cell.textContent);
                const snakeCase = headerText
                    .toLowerCase()
                    .replace(/[^\w\s]/g, ' ')
                    .replace(/\s+/g, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_|_$/g, '');
                headers.push(snakeCase || `column_${headers.length}`);
            });
            dataStartIndex = i + 1;
            break;
        }
    }

    // Extract data rows
    for (let i = dataStartIndex; i < allRows.length; i++) {
        const cells = allRows[i].querySelectorAll('td, th');
        const rowData = {};

        cells.forEach((cell, index) => {
            if (headers[index]) {
                rowData[headers[index]] = cleanText(cell.textContent);
            }
        });

        if (Object.keys(rowData).length > 0) {
            rows.push(rowData);
        }
    }

    return rows;
}

/**
 * Extracts data from a multi-row table (with headers and multiple data rows)
 * Now handles nested/collapsible detail rows
 */
function extractMultiRowTable(table) {
    const headers = [];
    const rows = [];

    // Extract headers
    const thead = table.querySelector('thead');
    if (thead) {
        const headerRow = thead.querySelector('tr');
        if (headerRow) {
            const headerCells = headerRow.querySelectorAll('th, td');
            headerCells.forEach(cell => {
                let headerText = cleanText(cell.textContent);
                // Convert to snake_case
                const snakeCase = headerText
                    .toLowerCase()
                    .replace(/[^\w\s]/g, ' ')
                    .replace(/\s+/g, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_|_$/g, '');
                headers.push(snakeCase || `column_${headers.length}`);
            });
        }
    }

    // Extract data rows
    const tbody = table.querySelector('tbody');
    if (tbody) {
        const dataRows = tbody.querySelectorAll('tr');
        let lastMainRow = null;

        dataRows.forEach(row => {
            // Check if this is a detail/expansion row
            if (isDetailRow(row)) {
                // Extract nested tables and attach to last main row
                if (lastMainRow) {
                    const nestedData = extractNestedTablesFromDetailRow(row);
                    if (Object.keys(nestedData).length > 0) {
                        Object.assign(lastMainRow, nestedData);
                    }
                }
                return; // Skip adding this row to the main data
            }

            // This is a regular data row
            const cells = row.querySelectorAll('th, td');
            const rowData = {};

            cells.forEach((cell, index) => {
                if (headers[index]) {
                    // Extract text value
                    rowData[headers[index]] = cleanText(cell.textContent);

                    // Extract link if present
                    const link = cell.querySelector('a');
                    if (link) {
                        const href = link.getAttribute('href');
                        if (href) {
                            rowData[headers[index] + '_url'] = href.startsWith('http') ? href : 'https://qpublic.schneidercorp.com' + href;
                        }
                    }

                    // Extract image if present
                    const img = cell.querySelector('img');
                    if (img) {
                        const imgSrc = img.getAttribute('src');
                        if (imgSrc) {
                            rowData[headers[index] + '_image_url'] = imgSrc.startsWith('http') ? imgSrc : 'https://qpublic.schneidercorp.com' + imgSrc;
                        }
                    }
                }
            });

            if (Object.keys(rowData).length > 0) {
                rows.push(rowData);
                lastMainRow = rowData; // Track for potential nested data
            }
        });
    }

    return rows;
}

/**
 * Determines if a table is a two-column key-value table
 */
function isTwoColumnTable(table) {
    return table.classList.contains('tabular-data-two-column');
}

/**
 * Determines if a table is a multi-row data table
 */
function isMultiRowTable(table) {
    const hasTheadTbody = table.querySelector('thead') && table.querySelector('tbody');
    const hasMultipleRows = table.querySelectorAll('tbody tr').length > 1;
    return hasTheadTbody || hasMultipleRows;
}

/**
 * Extracts section title from module header
 */
function getSectionTitle(section) {
    const header = section.querySelector('.module-header .title');
    if (header) {
        let title = cleanText(header.textContent);
        // Convert to snake_case
        return title
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_');
    }
    return null;
}

/**
 * Main parsing function - extracts all data from the HTML
 */
function parsePropertyHTML(html, tmk) {
    const root = parse(html);
    const status = detectPageStatus(html, root);

    const result = {
        tmk: tmk,
        status: status,
        parse_date: new Date().toISOString()
    };

    // If not a success or condo_project page, return early
    if (status !== 'success' && status !== 'condo_project') {
        return result;
    }

    // Extract data from all sections (same logic for both success and condo_project)
    const sections = root.querySelectorAll('section[id^="ctlBodyPane_"]');
    const islandCode = getIslandCode(tmk);

    sections.forEach(section => {
        const sectionTitle = getSectionTitle(section);
        if (!sectionTitle) return;

        const sectionData = {};

        // Check if there's a dedicated parser for this section
        if (SECTION_PARSERS[sectionTitle]) {
            const parsedData = SECTION_PARSERS[sectionTitle](section, islandCode);
            Object.assign(sectionData, parsedData);

            // Always skip generic table parsing when a dedicated parser exists
            // (even if parser returns empty object - this allows sections to be skipped)
            if (Object.keys(sectionData).length > 0) {
                result[sectionTitle] = sectionData;
            }
            return; // Skip generic parsing
        }

        // Find all tables in this section
        const tables = section.querySelectorAll('table');

        tables.forEach(table => {
            // Skip tables used for layout (role="presentation")
            if (table.getAttribute('role') === 'presentation' &&
                !table.classList.contains('tabular-data-two-column') &&
                !table.classList.contains('tabular-data')) {
                return;
            }

            if (isTwoColumnTable(table)) {
                // Extract key-value pairs
                const kvData = extractTwoColumnTable(table);
                Object.assign(sectionData, kvData);
            } else if (isMultiRowTable(table)) {
                // Extract multi-row table
                const tableId = table.id || 'table';
                let tableName = 'data';

                // Try to infer table name from ID
                if (tableId.includes('Valuation')) {
                    tableName = tableId.includes('Historical') ? 'historical_assessments' : 'current_assessments';
                } else if (tableId.includes('AllOwners')) {
                    tableName = 'all_owners';
                } else if (tableId.includes('Sales')) {
                    tableName = 'sales';
                } else {
                    // Use a generic name based on section
                    tableName = 'table_data';
                }

                const tableData = extractMultiRowTable(table);
                if (tableData.length > 0) {
                    sectionData[tableName] = tableData;
                }
            }
        });

        // Special handling for Map section - extract image URL
        if (sectionTitle === 'map' || sectionTitle === 'maps') {
            const mapImg = section.querySelector('img[id*="Map"]');
            if (mapImg) {
                const src = mapImg.getAttribute('src');
                if (src) {
                    sectionData.map_url = src.startsWith('http') ? src : 'https://qpublic.schneidercorp.com' + src;
                }
            }
        }

        // Special handling for Sketch section - extract image URL
        // Note: Sketch images are hosted on a different site (not qpublic), so use URL as-is
        if (sectionTitle === 'sketch' || sectionTitle === 'sketches') {
            const sketchImg = section.querySelector('img[id*="Sketch"]');
            if (sketchImg) {
                const src = sketchImg.getAttribute('src');
                if (src) {
                    sectionData.sketch_url = src;
                }
            }
        }

        // Special handling for Condominium/Apartment Unit Information section
        // Rename parcel_number_url to qpub_link for consistency
        if (sectionTitle === 'condominium_apartment_unit_information' && sectionData.table_data) {
            sectionData.table_data.forEach(row => {
                if (row.parcel_number_url) {
                    row.qpub_link = row.parcel_number_url;
                    delete row.parcel_number_url;
                }
            });
        }

        // Only add section if it has data
        if (Object.keys(sectionData).length > 0) {
            result[sectionTitle] = sectionData;
        }
    });

    // Special handling for Maui's "Untitled Section" which contains damage/reentry zone fields
    // Merge these fields into parcel_information
    if (result.untitled_section && result.parcel_information) {
        // Merge untitled_section data into parcel_information, but only copy non-null values
        for (const [key, value] of Object.entries(result.untitled_section)) {
            if (value !== null && value !== undefined) {
                result.parcel_information[key] = value;
            }
        }
        // Remove the untitled_section from result
        delete result.untitled_section;
    } else if (result.untitled_section && !result.parcel_information) {
        // If there's no parcel_information but there is untitled_section, rename it
        result.parcel_information = result.untitled_section;
        delete result.untitled_section;
    }

    // Normalize numeric values (convert dollar strings to proper numeric types)
    return normalizeNumericValues(result);
}

/**
 * Processes a single HTML file
 */
function processFile(inputFile, outputDir, condoOnly = false) {
    console.log(`Processing: ${inputFile}`);

    const html = fs.readFileSync(inputFile, 'utf-8');
    const tmk = extractTMKFromFilename(inputFile);

    const data = parsePropertyHTML(html, tmk);

    // Skip if condo-only mode and this isn't a condo project
    if (condoOnly && data.status !== 'condo_project') {
        console.log(`  Skipped: Not a condo project (status: ${data.status})`);
        return null;
    }

    // Get island code and create nested directory structure
    const islandCode = getIslandCode(tmk);
    let finalOutputDir = outputDir;

    if (islandCode && tmk) {
        // Use nested structure: outputDir is base, then add zone/section
        const nestedPath = getJsonPath(islandCode, tmk);
        // If outputDir contains the island code already, use nestedPath directly
        if (outputDir.includes(path.join(CONFIG.JSON_DIR, islandCode))) {
            finalOutputDir = nestedPath;
        } else {
            // Otherwise append the zone/section to outputDir
            const parts = tmk.split('-');
            if (parts.length >= 3) {
                finalOutputDir = path.join(outputDir, parts[1], parts[2]);
            }
        }
    }

    // Create output directory if it doesn't exist
    if (!fs.existsSync(finalOutputDir)) {
        fs.mkdirSync(finalOutputDir, { recursive: true });
    }

    // Determine output filename
    const basename = path.basename(inputFile, '.html');
    const outputFile = path.join(finalOutputDir, `${basename}.json`);

    // Write JSON file
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));

    console.log(`  Status: ${data.status}`);
    if (data.status === 'condo_project') {
        console.log(`  Units found: ${data.unit_count}`);
    }
    console.log(`  Output: ${outputFile}`);

    return data;
}

/**
 * Processes all HTML files in a directory
 */
function processDirectory(inputDir, outputDir, condoOnly = false) {
    // Auto-detect island code from input directory if not specified in output
    let finalOutputDir = outputDir;

    // If outputDir is not provided or is a base directory, detect island from input
    if (!outputDir || outputDir === './parsed-output') {
        const inputDirName = path.basename(inputDir);
        const islandCode = inputDirName.match(/^[1-4]$/) ? inputDirName : null;

        if (islandCode) {
            // If parsing from NAS structure, output to NAS structure
            if (inputDir.includes(CONFIG.HTML_DIR)) {
                finalOutputDir = getJsonPath(islandCode);
                console.log(`Auto-detected island ${islandCode} (${CONFIG.ISLANDS[islandCode]})`);
                console.log(`Output directory: ${finalOutputDir}\n`);
            }
        }
    }

    // Create output directory if it doesn't exist
    if (!fs.existsSync(finalOutputDir)) {
        fs.mkdirSync(finalOutputDir, { recursive: true });
    }

    const files = fs.readdirSync(inputDir);
    const htmlFiles = files.filter(f => f.endsWith('.html'));

    console.log(`Found ${htmlFiles.length} HTML files in ${inputDir}${condoOnly ? ' (condo-only mode)' : ''}\n`);

    const stats = {
        total: 0,
        success: 0,
        condo_project: 0,
        blocked: 0,
        captcha: 0,
        failed: 0,
        unknown: 0,
        skipped: 0
    };

    htmlFiles.forEach(file => {
        const inputFile = path.join(inputDir, file);
        const data = processFile(inputFile, finalOutputDir, condoOnly);

        if (data === null) {
            stats.skipped++;
            return;
        }

        stats.total++;
        stats[data.status]++;
    });

    console.log('\n=== Summary ===');
    console.log(`Total files processed: ${stats.total}`);
    console.log(`  Success: ${stats.success}`);
    console.log(`  Condo Project: ${stats.condo_project}`);
    console.log(`  Blocked: ${stats.blocked}`);
    console.log(`  Captcha: ${stats.captcha}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Unknown: ${stats.unknown}`);
    if (condoOnly) {
        console.log(`  Skipped (non-condo): ${stats.skipped}`);
    }

    return stats;
}

// Main execution (only run if this is the main module)
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node parse.js <input-file-or-dir> [output-dir] [options]');
    console.log('\nOptions:');
    console.log('  --condo-only    Only parse condo project files, skip all others');
    console.log('  --help, -h      Show this help message');
    console.log('\nExamples:');
    console.log('  # Parse sample files');
    console.log('  node parse.js sample-html-pages/success/3-9-2-020-005-0000.html');
    console.log('  node parse.js sample-html-pages/success parsed-output');
    console.log('  node parse.js sample-html-pages parsed-output');
    console.log('\n  # Parse only condo projects');
    console.log('  node parse.js sample-html-pages/success parsed-output --condo-only');
    console.log('\n  # Parse from NAS (auto-detects island and output directory)');
    console.log(`  node parse.js ${path.join(CONFIG.NAS_PATH, CONFIG.HTML_DIR, '1')}`);
    console.log(`  node parse.js ${path.join(CONFIG.NAS_PATH, CONFIG.HTML_DIR, '2')}`);
    console.log('\n  # Or specify custom output directory');
    console.log(`  node parse.js ${path.join(CONFIG.NAS_PATH, CONFIG.HTML_DIR, '1')} ${path.join(CONFIG.NAS_PATH, CONFIG.JSON_DIR, '1')}`);
    console.log('\nNAS Path: ' + CONFIG.NAS_PATH);
    console.log(`JSON Output: ${CONFIG.NAS_PATH}/${CONFIG.JSON_DIR}/[1-4]/`);
    process.exit(1);
}

    // Parse arguments
    const condoOnly = args.includes('--condo-only');
    const nonFlagArgs = args.filter(arg => !arg.startsWith('--'));

    const input = nonFlagArgs[0];
    const output = nonFlagArgs[1] || './parsed-output';

    const inputStat = fs.statSync(input);

    if (inputStat.isDirectory()) {
        processDirectory(input, output, condoOnly);
    } else if (inputStat.isFile()) {
        processFile(input, output, condoOnly);
    } else {
        console.error('Input must be a file or directory');
        process.exit(1);
    }
}

export {
    parsePropertyHTML,
    extractTMKFromFilename,
    detectPageStatus,
    processFile,
    processDirectory
};
