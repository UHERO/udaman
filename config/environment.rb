# Load the Rails application.
require_relative 'application'

# Initialize the Rails application.
Rails.application.initialize!

ENV['DATAFILES_PATH'] = 'spec'
ENV['LOAD_UPDATE_SPREADSHEET_PATTERNS_TO_DB'] = 'false'
## Set following var on upgrade to Rails5, because old production.rb had "config.serve_static_files = true", and
## this was apparently the new way to enable this option. Not sure why we need it, but trying to keep status quo.
ENV['RAILS_SERVE_STATIC_FILES'] = 'true'

ENV['DATA_PATH'] ||= '/data'   ## Location of flat file directory
ENV['SEARCH_DEFAULT_LIMIT'] ||= '500'  ## Default limit on number of results returned by search box

# API_KEY_BEA, API_KEY_FRED must be provided by the outer environment if
# those APIs are to be used.
