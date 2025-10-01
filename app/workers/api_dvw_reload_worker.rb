require 'sidekiq'
require 'redis'

# Purpose of the worker is to reload the series loaded from the dvw api immediately after an upload is completed.
# Series then need to be seasonally adjusted and the public data points need to be resynced, but SA is done outside
# UDAMAN, so those will stay manual processes for now.
class ApiDvwReloadWorker
  include Sidekiq::Worker
  sidekiq_options queue: :default, retry: 3

  def initialize
    @logprefix = self.class
  end

  def perform(dvw_upload_id)
    @dvw_upload = DvwUpload.find(dvw_upload_id)

    mylogger :info, 'Starting API DVW series reload with dependencies'

    api_dvw_series = Series.search("#api_dvw", limit: 10000)

    if api_dvw_series.empty?
      mylogger :warn, 'No series found with #api_dvw data sources'
      return
    end

    mylogger :info, "Found #{api_dvw_series.count} series with #api_dvw data sources"

    series_ids = api_dvw_series.pluck(:id)

    begin
      mylogger :info, "Calling reload_with_dependencies for #{series_ids.count} series"
      Series.reload_with_dependencies(series_ids, 'api_dvw', nightly: false, clear_first: false)
      mylogger :info, "API DVW reload with dependencies completed successfully"
    rescue => e
      mylogger :error, "Failed to reload with dependencies: #{e.message}"
      raise
    end

  rescue => e
    mylogger :error, "API DVW reload job failed: #{e.message}"
    mylogger :error, e.backtrace.join("\n")
    raise # Let Sidekiq handle retries
  end

  private

  def mylogger(level, message)
    Rails.logger.send(level) { "#{@logprefix} (DVW #{@dvw_upload.id}): #{message}" }
  end
end
