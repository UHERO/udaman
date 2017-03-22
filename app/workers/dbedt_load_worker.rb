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
    wipe_the_old_data()
    load_cats_csv(dbu.file_abspath('cats').change_file_ext('csv'))
    load_series_csv(dbu.file_abspath('series').change_file_ext('csv'))
  end
end
