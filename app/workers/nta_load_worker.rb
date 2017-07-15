require 'sidekiq'
require 'redis'

class NtaLoadWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def initialize
    ################# change this when testing done
    logger.level = Logger::DEBUG
  end

  def perform(nta_id)
    upload = nil
    begin
      upload = NtaUpload.find(nta_id) || raise("No NtaUpload found with id=#{nta_id}")
      upload.full_load
      upload.update!(cats_status: :ok, last_error: nil, last_error_at: nil)
    rescue => error
      upload.update(cats_status: :fail, last_error: error.message, last_error_at: Time.now)
      logger.error { "NtaLoadWorker load failed: #{error.message}" }
      logger.error error.backtrace
    end
  end
end
