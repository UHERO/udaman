# generates udaman_tsd files
class ExportWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform
    Series.run_tsd_exports
    ### then rsync the results to prod
  end
end
