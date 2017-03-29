require 'sidekiq'
require 'redis'

class DbedtLoadWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(dbu_id)
    dbu = DbedtUpload.find(dbu_id)
    dbu.load_series_csv
    if dbu.load_cats_csv
      dbu.update active: true, cats_status: :ok
      return
    end
    logger.warn "loading cats failed"
    dbu.update cats_status: :fail
  end
end
