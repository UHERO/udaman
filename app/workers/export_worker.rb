class ExportWorker
  include Sidekiq::Worker
  include Sidekiq::Status::Worker

  sidekiq_options queue: :default

  def perform
    Rails.logger.info { "ExportWorker: START at #{Time.now}" }
    begin
      Series.run_tsd_exports
      Rails.logger.info { "ExportWorker: COMPLETED successfully at #{Time.now}" }
    rescue => e
      Rails.logger.error { "ExportWorker: FAILED with error: #{e.class}: #{e.message}" }
      Rails.logger.error { "ExportWorker: Backtrace:\n#{e.backtrace.join("\n")}" }
      raise  # Re-raise so Sidekiq marks it as failed
    end
  end
end
