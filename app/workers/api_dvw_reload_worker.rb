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

    mylogger :info, 'Starting API DVW series reload'

    api_dvw_series = Series.search("#api_dvw", limit: 10000)

    if api_dvw_series.empty?
      mylogger :warn, 'No series found with #api_dvw data sources'
      return
    end

    mylogger :info, "Found #{api_dvw_series.count} series with #api_dvw data sources"

    success_count = 0
    fail_count = 0

    api_dvw_series.each do |series|
      mylogger :debug, "Reloading #{series.name}"

      begin
        if series.reload_sources(nightly: false, clear_first: false)
          success_count += 1
        else
          fail_count += 1
          mylogger :error, "Failed to reload #{series.name} (no exception)"
        end
      rescue => e
        fail_count += 1
        mylogger :error, "Failed to reload #{series.name}: #{e.message}"
      end
    end

    mylogger :info, "API DVW reload completed: #{success_count} success, #{fail_count} failed of #{api_dvw_series.count} total"

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
