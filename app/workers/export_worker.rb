## Export TSD format files and sync up to both production and Mac mini
class ExportWorker
  include Sidekiq::Worker
  sidekiq_options queue: :critical

  def perform
    Series.run_tsd_exports
  end
end
