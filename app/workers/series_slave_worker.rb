require 'sidekiq'
require 'redis'

class SeriesSlaveWorker
  include Sidekiq::Worker

  sidekiq_options :retry => 0  ## do not retry jobs, but log failures

  sidekiq_retries_exhausted do |msg, e|
    Sidekiq.logger.error "Failed #{msg['class']}/#{e.class} with #{msg['args']}: #{msg['error_message']}"
  end

  def perform(batch_id, series_id)
    @batch = batch_id
    @series = series_id
    begin
      series = Series.find(series_id) rescue nil
      log = SeriesSlaveLog.find_by(batch_id: batch_id, series_id: series_id)
      unless log
        mylogger :warn, "Cannot find slavelog for batch=#{batch_id}, series=#{series_id}"
        return
      end
      errors = []
      if series
        @series = "#{series.name} (#{series_id})"
        mylogger :info, 'reload started'
        errors = series.reload_sources(true)
      else
        mylogger :warn, 'no such series found'
        errors.push 'no such series found'
      end
      if errors.empty?
        mylogger :info, 'reload SUCCEEDED'
        log.update_attributes message: 'succeeded'
      else
        mylogger :warn, 'reload ERRORED: check reload_errors.log'
        log.update_attributes message: 'errored, check reload_errors.log'
        File.open('public/reload_errors.log', 'a') {|f| f.puts errors }
      end
    rescue Exception => e
      mylogger :error, "error rescued: #{e.message}, backtrace follows:\n#{e.backtrace}"
      log.update_attributes message: "error rescued: #{e.message}"
    end
  end

private
  def mylogger(level, message)
    Sidekiq.logger.send(level) { "#{self.class}: batch=#{@batch}: series=#{@series}: #{message}" }
  end
end
