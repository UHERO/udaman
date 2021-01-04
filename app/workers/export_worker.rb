class ExportWorker
  include Sidekiq::Worker
  include Sidekiq::Status::Worker

  sidekiq_options queue: :default

  def perform
    Series.run_tsd_exports
  end
end
