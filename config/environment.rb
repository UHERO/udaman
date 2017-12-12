# Load the rails application
require File.expand_path('../application', __FILE__)

# Initialize the rails application
UheroDb::Application.initialize!
ENV['DATAFILES_PATH'] = 'spec'
ENV['LOAD_UPDATE_SPREADSHEET_PATTERNS_TO_DB'] = 'false'

# Sets the default environment variables
ENV['DEFAULT_DATA_PATH'] = '/Users/uhero/Documents/data'
ENV['DATA_PATH'] ||= ENV['DEFAULT_DATA_PATH']
ENV['API_KEY_FRED'] ||= '1030292ef115ba08c1778a606eb7a6cc'
ENV['API_KEY_BEA'] ||= '66533E32-0B70-4EF6-B367-05662C3B7CA8'
