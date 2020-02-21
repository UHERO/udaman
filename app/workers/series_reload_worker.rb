require 'sidekiq'
require 'redis'

class SeriesReloadWorker
  include Sidekiq::Worker
  include Sidekiq::Status::Worker

  sidekiq_options :retry => 0  ## do not retry jobs, but log failures

  sidekiq_retries_exhausted do |msg, e|
    Sidekiq.logger.error "Failed #{msg['class']}/#{e.class} with #{msg['args']}: #{msg['error_message']}"
  end

  def perform(batch_id, series_id, depth, clear_first = false)
    @batch = batch_id
    @series = series_id
    @depth = depth
    log = nil
    begin
      series = Series.find(series_id) rescue nil
      log = SeriesReloadLog.find_by(batch_id: batch_id, series_id: series_id)
      unless log
        mylogger :warn, 'no reload log found'
        raise "no reload log found for batch=#{@batch}, series=#{@series}"
      end
      if series
        @series = "<#{series.name}> (#{series_id})"
        mylogger :info, 'reload started'
        success = series.reload_sources(true, clear_first)  ####       <<===== here's where the work happens
      else
        mylogger :warn, 'no such series found'
        success = false
      end

      if success
        log.update_attributes(status: 'succeeded') unless log.reload.status
        mylogger :info, 'reload SUCCEEDED'
      else
        log.update_attributes(status: 'error occurred') unless log.reload.status
        mylogger :warn, 'reload ERRORED: check logs'
      end
    rescue => e
      if log && log.reload.status.nil?
        log.update_attributes(status: "rescued: #{e.message}"[0..253])  ## don't overflow the string field
      end
      mylogger :error, "rescued: #{e.message}, backtrace follows:\n#{e.backtrace}"
    end
  end

private
  def mylogger(level, message)
    Sidekiq.logger.send(level) { "batch=#{@batch} depth=#{@depth} series=#{@series}: #{message}" }
  end
end
