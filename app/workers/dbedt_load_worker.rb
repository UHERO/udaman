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
#    wipe_the_old_data()
#    load_cats_csv(dbu.file_abspath('cats').change_file_ext('csv'))
#    load_series_csv(dbu.file_abspath('series').change_file_ext('csv'))
  ### following stuff just for testing UI aspects
    puts ">>>>> DEBUG : WORKER: here"
    sleep(6)
    x = rand(2)
    puts ">>>>> DEBUG : WORKER: before set active"
    dbu.set_active(x == 0 ? 'fail' : 'yes')
  end
end
