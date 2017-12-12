# Load the rails application
require File.expand_path('../application', __FILE__)

# Initialize the rails application
UheroDb::Application.initialize!
ENV['DATAFILES_PATH'] = 'spec'
ENV['LOAD_UPDATE_SPREADSHEET_PATTERNS_TO_DB'] = 'false'

# Sets the default environment variables
ENV['DEFAULT_DATA_PATH'] = '/Users/uhero/Documents/data'
ENV['DATA_PATH'] ||= ENV['DEFAULT_DATA_PATH']
# API_KEY_BEA, API_KEY_FRED must be provided by the outer environment if
# those APIs are to be used.