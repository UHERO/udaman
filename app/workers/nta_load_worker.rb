require 'sidekiq'
require 'redis'

class NtaLoadWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(nta_id)
    upload = nil
    begin
      upload = NtaUpload.find(nta_id) || raise("No NtaUpload found with id=#{nta_id}")
      upload.load_series_csv
      logger.debug { "NtaUpload id=#{nta_id} DONE load series" }
      upload.load_cats_csv
      logger.debug { "NtaUpload id=#{nta_id} DONE load cats" }
      upload.make_active_settings
      upload.update!(cats_status: :ok, last_error: nil, last_error_at: nil)
      logger.info { "NtaUpload id=#{nta_id} loaded as active" }
    rescue => error
      upload.update(cats_status: :fail, last_error: error.message, last_error_at: Time.now)
      logger.error { "NtaUpload load failed: #{error.message}" }
    end
  end
end
