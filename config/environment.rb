# Load the rails application
require File.expand_path('../application', __FILE__)

# Initialize the rails application
UheroDb::Application.initialize!
ENV["DATAFILES_PATH"] = "spec"
ENV["LOAD_UPDATE_SPREADSHEET_PATTERNS_TO_DB"] = "false"
ENV["JON"] = "false"

# Sets the default environment variables
ENV['DATA_PATH'] = ENV['DATA_PATH'] || '/Users/uhero/Documents/data'
