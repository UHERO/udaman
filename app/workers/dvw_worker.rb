require 'sidekiq'
require 'redis'

class DvwWorker
  include Sidekiq::Worker
  sidekiq_options queue: :critical

  def initialize
    @logprefix = self.class
  end

  def perform(dvw_id, do_csv_proc = false)
    mylogger :info, "Entering perform async: id=#{dvw_id}"
    upload = nil
    begin
      upload = DvwUpload.find(dvw_id) || raise("No DvwUpload found with id=#{dvw_id}")
      upload.worker_tasks(do_csv_proc)
    rescue => error
      mylogger :error, error.message
      mylogger :error, error.backtrace
      if upload
        upload.update(series_status: :fail, last_error: error.message[0..254], last_error_at: Time.now)
      end
    end
  end

private
  def mylogger(level, message)
    Rails.logger.send(level) { "#{@logprefix}: #{message}" }
  end
end
