require 'sidekiq'
require 'redis'

class SeriesSlaveWorker
  include Sidekiq::Worker

  sidekiq_options :retry => 0  ## do not retry jobs, but log failures

  sidekiq_retries_exhausted do |msg, e|
    Sidekiq.logger.error "Failed #{msg['class']}/#{e.class} with #{msg['args']}: #{msg['error_message']}"
  end

  def perform(series_id, batch_id)
    @batch_id = batch_id
    begin
      series = Series.find(series_id)
      errors = []
      if series
        mylogger :info, "Reload series #{series_id} (#{series.name}) started"
        errors = series.reload_sources(true)
      else
        errors.push "No series with id=#{series_id} found"
      end
      GC.start
      if errors.empty?
        mylogger :info, "Reload series #{series_id} (#{series.name}) SUCCEEDED"
      else
        mylogger :info, "Reload series #{series_id} ERRORED: check reload_errors.log"
        File.open('public/reload_errors.log', 'a') {|f| f.puts errors }
      end
    rescue
    end
  end

private
  def mylogger(level, message)
    Sidekiq.logger.send(level) { "batch=#{@batch_id}: #{message}" }
  end
end
