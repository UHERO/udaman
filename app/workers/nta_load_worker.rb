require 'sidekiq'
require 'redis'

class NtaLoadWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(nta_id)
    begin
      ntu = NtaUpload.find(nta_id)
      unless ntu
        raise "No NtaUpload found with id=#{nta_id}"
      end
      unless ntu.load_series_csv
        raise 'Some error in load_series_csv'
        ########### make this more specific NOW! by pushing exception throw down into method -dji
      end
      logger.debug { "NtaUpload id=#{nta_id} DONE load series" }
      unless ntu.load_cats_csv
        raise 'Some error in load_cats_csv'
        ########### make this more specific NOW! by pushing exception throw down into method -dji
      end
      logger.debug { "NtaUpload id=#{nta_id} DONE load cats" }
      ntu.make_active_settings
      ntu.update(cats_status: :ok, last_error: nil, last_error_at: nil)
      logger.info { "NtaUpload id=#{nta_id} loaded as active" }
    rescue => error
      ntu.update(cats_status: :fail, last_error: error.message, last_error_at: Time.now)
      logger.error { "NtaUpload load failed: #{error.message}" }
    end
  end
end
