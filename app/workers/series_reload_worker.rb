require 'sidekiq'
require 'redis'

class SeriesReloadWorker
  include Sidekiq::Worker
  include Sidekiq::Status::Worker

  sidekiq_options :retry => 0  ## do not retry jobs, but log failures

  sidekiq_retries_exhausted do |msg, e|
    Sidekiq.logger.error "Failed #{msg['class']}/#{e.class} with #{msg['args']}: #{msg['error_message']}"
  end

  def perform(batch_id, series_id)
    @batch = batch_id
    @series = series_id
    begin
      series = Series.find(series_id) rescue nil
      errors = []
      if series
        @series = "#{series.name} (#{series_id})"
        mylogger :info, 'reload started'
        errors = series.reload_sources(true)
      else
        mylogger :warn, 'no such series found'
        errors.push 'no such series found'
      end
      log = SeriesReloadLog.find_by(batch_id: batch_id, series_id: series_id)
      unless log
        mylogger :warn, 'no reload log found'
        raise "no reload log found for batch=#{@batch}, series=#{@series}"
      end
      if errors.empty?
        log.update_attributes(status: 'succeeded') unless log.status
        mylogger :info, 'reload SUCCEEDED'
      else
        log.update_attributes(status: 'errored, check reload_errors.log') unless log.status
        mylogger :warn, 'reload ERRORED: check reload_errors.log'
        File.open('public/reload_errors.log', 'a') {|f| f.puts errors }
      end
    rescue Exception => e
      if log && log.reload.status.nil?
        log.update_attributes(status: "error rescued: #{e.message}")
      end
      mylogger :error, "error rescued: #{e.message}, backtrace follows:\n#{e.backtrace}"
    end
  end

private
  def mylogger(level, message)
    Sidekiq.logger.send(level) { "#{self.class}: batch=#{@batch}: series=#{@series}: #{message}" }
  end
end
