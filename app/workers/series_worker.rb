require 'sidekiq'
require 'redis'

class SeriesWorker
  include Sidekiq::Worker

  sidekiq_options(retry: 0)  ## do not retry jobs, but log failures

  sidekiq_retries_exhausted do |msg, e|
    Sidekiq.logger.error "Failed #{msg['class']} with #{msg['args']}: #{msg['error_message']}"
    failure = SidekiqFailure.find_or_create_by(series_id: msg['args'][0].to_i)
    failure.update_attributes message: "Batch ID: #{msg['args'][1]}: #{e.class}: #{msg['error_message']}"
  end

  def perform(series_id, batch_id)
    logger.info "SIDEKIQ perform: started on series #{series_id}"

    keys = {
      queue: "queue_#{batch_id}",
      busy_workers: "busy_workers_#{batch_id}",
      finishing_depth: "finishing_depth_#{batch_id}",
      waiting_workers: "waiting_workers_#{batch_id}",
      current_depth: "current_depth_#{batch_id}",
      series_list: "series_list_#{batch_id}"
    }
    finisher = false

    begin
      redis = Redis.new
      redis.pipelined do
        redis.decr keys[:queue]
        redis.incr keys[:busy_workers]
      end
      current_depth = redis.get(keys[:current_depth]).to_i
      log_prefix = "batch=#{batch_id},depth=#{current_depth}"

      series = Series.find(series_id)
      errors = []
      if series
        logger.info "#{log_prefix}: Reload series #{series_id} (#{series.name}) started"
        errors = series.reload_sources(true)
      else
        errors.push "No series with id=#{series_id} found"
      end
      GC.start
      if errors.empty?
        logger.info "#{log_prefix}: Reload series #{series_id} (#{series.name}) SUCCEEDED"
      else
        logger.info "#{log_prefix}: Reload series #{series_id} ERRORED: check reload_errors.log"
        File.open('public/reload_errors.log', 'a') {|f| f.puts errors }
      end
      # check to see if the queue is empty
      if redis.get(keys[:queue]).to_i > 0 && Sidekiq::Queue.new.size > 0
        logger.debug "#{log_prefix}: queue is not empty"
        raise 'earlyreturn'
      end
      logger.debug "#{log_prefix}: queue is empty"
      # if the queue is empty see if another job has raised the flag
      if redis.getset(keys[:finishing_depth], 'true') == 'true'
        logger.debug "#{log_prefix}: another worker will finish"
        raise 'earlyreturn'
      end
      finisher = true

      redis.incr keys[:waiting_workers]
      logger.debug "#{log_prefix}: This worker will finish"
      # wait for everyone else to finish
      sleep(1)
      while redis.get(keys[:busy_workers]).to_i > 1 && Sidekiq::Workers.new.size > 1
        logger.debug "#{log_prefix}: waiting for other workers to finish"
        sleep(1)
        # the random component helps avoid a race condition between two processes
        if redis.get(keys[:waiting_workers]).to_i > 1 &&
            redis.get(keys[:busy_workers]).to_i > 1 &&
            Sidekiq::Workers.new.size > 1 &&
            rand > 0.5
          logger.debug "#{log_prefix}: breaking ties"
          redis.decr keys[:waiting_workers]
          raise 'earlyreturn'
        end
      end
      # if no workers are busy, the queue should be filled with the next depth
      redis.decr keys[:waiting_workers]

      next_depth = current_depth - 1
      if next_depth == -1
        logger.debug "#{log_prefix}: on last depth"
        redis.set keys[:busy_workers], 1
        raise 'earlyreturn'
      end
      logger.info "#{log_prefix}: Trying next depth=#{next_depth}"
      series_ids = redis.get(keys[:series_list]).scan(/\d+/).map{|s| s.to_i}
      next_series = Series.all.where(:id => series_ids, :dependency_depth => next_depth)
      while next_series.count == 0
        logger.info "#{log_prefix}: Depth=#{next_depth} is empty"
        next_depth -= 1
        logger.info "#{log_prefix}: Trying next depth: #{next_depth}"
        if next_depth == -1
          logger.debug "#{log_prefix}: set busy_workers counter to 1 (next_series.count == 0)"
          redis.set keys[:busy_workers], 1
          raise 'earlyreturn'
        end
        next_series = Series.all.where(:id => series_ids, :dependency_depth => next_depth)
      end

      logger.info "#{log_prefix}: Queueing up next depth=#{next_depth}, number of series=#{next_series.count}"
      redis.pipelined do
        redis.set keys[:queue], next_series.count
        redis.set keys[:current_depth], next_depth
        redis.set keys[:finishing_depth], false
        redis.set keys[:busy_workers], 1
      end
      next_series.pluck(:id).each do |id|
        SeriesWorker.perform_async id, batch_id
      end
      logger.debug "#{log_prefix}: done queueing up next depth=#{next_depth}"

    rescue => e
      return if e.message == 'earlyreturn'  ## Ensure block WILL be executed before return!
      logger.error "#{log_prefix}: Reload series #{series_id} FAILED: #{e.message}; Backtrace follows"
      logger.error e.backtrace
      if finisher
        redis.set keys[:finishing_depth], false
      end
      redis.pipelined do
        redis.incr keys[:busy_workers]
        redis.incr keys[:queue]
      end
      raise

    ensure
      if finisher
        redis.set keys[:finishing_depth], false
      end
      # busy workers had been going negative
      if redis.get(keys[:busy_workers]).to_i > 0
        redis.decr keys[:busy_workers]
      end
      logger.info "SIDEKIQ perform: finished with series #{series_id}"
      failure = SidekiqFailure.find_by(series_id: series_id)
      failure.destroy if failure
    end
  end

end
