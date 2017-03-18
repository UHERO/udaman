# Convert xlsx files to csv format
require 'sidekiq'
require 'redis'
## require 'DbedtLoadCats'
## require 'DbedtLoadSeries'

class DbedtLoadWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(dbu_id)
    dbu = DbedtUpload.find(dbu_id)
    load_cats_csv(dbu.file_abspath('cats'))
    load_series_csv(dbu.file_abspath('series'))
  end
end
