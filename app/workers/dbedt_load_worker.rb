require 'sidekiq'
require 'redis'

class DbedtLoadWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(dbu_id)
    Rails.logger.info { "ENTER DbedtLoadWorker.perform async: id=#{dbu_id}" }
    begin
      dbu = DbedtUpload.find(dbu_id)
      unless dbu
        raise "No DbedtUpload found with id=#{dbu_id}"
      end
      Rails.logger.debug { "DbedtUpload id=#{dbu_id} Start deleting universe DBEDT" }
      DbedtUpload.delete_universe_dbedt
      Rails.logger.debug { "DbedtUpload id=#{dbu_id} DONE deleting universe DBEDT, Start load series" }

      unless dbu.load_series_csv
        raise 'Some error in load_series_csv'
        ## make this more specific later by pushing exception throw down into method -dji
      end
      Rails.logger.debug { "DbedtUpload id=#{dbu_id} DONE load series, Start load cats" }

      unless dbu.load_cats_csv
        raise 'Some error in load_cats_csv'
        ## make this more specific later by pushing exception throw down into method -dji
      end
      Rails.logger.debug { "DbedtUpload id=#{dbu_id} DONE load cats" }

      dbu.make_active_settings
      dbu.update!(cats_status: :ok, last_error: nil, last_error_at: nil)
      Rails.logger.info { "DbedtUpload id=#{dbu_id} loaded as active" }
    rescue => error
      dbu.update(cats_status: :fail, last_error: error.message, last_error_at: Time.now)
      Rails.logger.error { "DbedtUpload load failed: #{error.message}" }
    end
    Rails.logger.info { "DONE DbedtLoadWorker.perform async: id=#{dbu_id}" }
  end
end
